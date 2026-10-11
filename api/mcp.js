export const config = { runtime: 'edge' };

import { checkRateLimit, getClientIP, corsHeaders, rateLimitHeaders } from './_lib/rate-limit.js';

// MCP Streamable HTTP endpoint
// Auth: Bearer token via Authorization header against MCP_API_KEY
// Rate limiting: 60 req/min per IP
// Implements MCP JSON-RPC 2.0 over HTTP stateless

const SERVER_NAME = 'minecraft-en-espanol';
const SERVER_VERSION = '1.0.0';
const SUPABASE_URL = 'https://mtkesqoywahieuapftmh.supabase.co';
const MCP_API_KEY = process.env.MCP_API_KEY || 'dev-mcp-key-change-in-production';

const TABLES = {
  noticias: { name: 'noticias', slugField: 'slug', titleField: 'titulo' },
  guias: { name: 'guias', slugField: 'slug', titleField: 'titulo' },
  curiosidades: { name: 'curiosidades', slugField: 'id', titleField: 'texto' },
  quiz: { name: 'quiz', slugField: 'id', titleField: 'pregunta' },
  otros: { name: 'otros', slugField: 'slug', titleField: 'titulo' },
};

function toSlug(str) {
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function validateSlug(slug) {
  return slug && /^[a-z0-9-]+$/.test(slug) && slug.length <= 80;
}

function validateUUID(id) {
  return id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

// Core tool implementations (adapted from mcp-server.js)
async function handleTool(name, args) {
  try {
    switch (name) {
      case 'get_content': {
        const { type, identifier } = args;
        const table = TABLES[type];
        const field = identifier.includes('-') && identifier.length > 20 ? 'id' : table.slugField;
        
        const url = `${SUPABASE_URL}/rest/v1/${table.name}?${field}=eq.${encodeURIComponent(identifier)}&select=*`;
        const options = { 
          headers: { 
            apikey: process.env.SUPABASE_SERVICE_KEY, 
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` 
          } 
        };
        
        const response = await fetch(url, options);
        const data = await response.json();
        
        if (!response.ok) throw new Error(`Supabase error: ${response.status}`);
        if (!Array.isArray(data) || data.length === 0) throw new Error(`Not found: ${type}/${identifier}`);
        
        return { content: [{ type: 'text', text: JSON.stringify(data[0], null, 2) }] };
      }

      case 'list_content': {
        const { type, limit = 20, offset = 0, orderBy = 'created_at.desc' } = args;
        const table = TABLES[type];
        
        const url = `${SUPABASE_URL}/rest/v1/${table.name}?select=*&order=${encodeURIComponent(orderBy)}&limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`;
        const options = { 
          headers: { 
            apikey: process.env.SUPABASE_SERVICE_KEY, 
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` 
          } 
        };
        
        const response = await fetch(url, options);
        const data = await response.json();
        
        if (!response.ok) throw new Error(`Supabase error: ${response.status}`);
        
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }

      case 'search_content': {
        const { query, types = Object.keys(TABLES), limit = 10 } = args;
        const results = [];
        
        for (const type of types) {
          const table = TABLES[type];
          const searchField = type === 'quiz' ? 'pregunta' : (table.titleField || 'titulo');
          
          const url = `${SUPABASE_URL}/rest/v1/${table.name}?${searchField}=ilike.%${encodeURIComponent(query)}%&select=*&limit=${encodeURIComponent(limit)}`;
          const options = { 
            headers: { 
              apikey: process.env.SUPABASE_SERVICE_KEY, 
              Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` 
            } 
          };
          
          const response = await fetch(url, options);
          const data = await response.json();
          
          if (!response.ok) continue;
          if (Array.isArray(data) && data.length) {
            results.push(...data.map(d => ({ ...d, _type: type })));
          }
        }
        
        return { content: [{ type: 'text', text: JSON.stringify(results.slice(0, limit), null, 2) }] };
      }

      case 'create_content': {
        const { type, data, metadata = {} } = args;
        if (!['noticia', 'guia', 'curiosidad', 'quiz', 'otros'].includes(type)) {
          throw new Error(`Invalid type for creation: ${type}`);
        }
        
        const tableMap = { noticia: 'noticias', guia: 'guias', curiosidad: 'curiosidades', quiz: 'quiz', otros: 'otros' };
        const table = tableMap[type];
        
        const titleField = type === 'quiz' ? 'pregunta' : 'titulo';
        const slug = data.slug || toSlug(data[titleField] || data.texto?.slice(0, 50) || 'contenido');
        
        const proposal = {
          tipo: type,
          accion: 'crear',
          datos_propuestos: { ...data, slug },
          metadatos: {
            fuente: 'mcp-client-chatgpt',
            timestamp: new Date().toISOString(),
            confianza: 0.9,
            ...metadata
          },
          status: 'pending'
        };
        
        const url = `${SUPABASE_URL}/rest/v1/mcp_propuestas`;
        const options = { 
          method: 'POST',
          headers: { 
            apikey: process.env.SUPABASE_SERVICE_KEY, 
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation'
          },
          body: JSON.stringify(proposal)
        };
        
        const response = await fetch(url, options);
        const result = await response.json();
        
        if (!response.ok) throw new Error(`Supabase error: ${response.status}`);
        
        return { content: [{ type: 'text', text: JSON.stringify({ success: true, proposal: Array.isArray(result) ? result[0] : result }, null, 2) }] };
      }

      case 'update_content': {
        const { type, identifier, data } = args;
        const table = TABLES[type];
        const field = identifier.includes('-') && identifier.length > 20 ? 'id' : table.slugField;
        
        const url = `${SUPABASE_URL}/rest/v1/${table.name}?${field}=eq.${encodeURIComponent(identifier)}`;
        const options = { 
          method: 'PATCH',
          headers: { 
            apikey: process.env.SUPABASE_SERVICE_KEY, 
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation'
          },
          body: JSON.stringify(data)
        };
        
        const response = await fetch(url, options);
        
        if (!response.ok) throw new Error(`Supabase error: ${response.status}`);
        
        return { content: [{ type: 'text', text: JSON.stringify({ success: true }, null, 2) }] };
      }

      case 'delete_content': {
        const { type, identifier } = args;
        const table = TABLES[type];
        const field = identifier.includes('-') && identifier.length > 20 ? 'id' : table.slugField;
        
        const url = `${SUPABASE_URL}/rest/v1/${table.name}?${field}=eq.${encodeURIComponent(identifier)}`;
        const options = { 
          method: 'DELETE',
          headers: { 
            apikey: process.env.SUPABASE_SERVICE_KEY, 
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` 
          } 
        };
        
        const response = await fetch(url, options);
        
        if (!response.ok) throw new Error(`Supabase error: ${response.status}`);
        
        return { content: [{ type: 'text', text: JSON.stringify({ success: true }, null, 2) }] };
      }

      case 'get_pending_approvals': {
        const { limit = 20 } = args;
        
        const url = `${SUPABASE_URL}/rest/v1/mcp_propuestas?status=eq.pending&select=*&order=creado_en.desc&limit=${encodeURIComponent(limit)}`;
        const options = { 
          headers: { 
            apikey: process.env.SUPABASE_SERVICE_KEY, 
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` 
          } 
        };
        
        const response = await fetch(url, options);
        const data = await response.json();
        
        if (!response.ok) throw new Error(`Supabase error: ${response.status}`);
        
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }

      case 'approve_content': {
        const { proposalId } = args;
        
        // Fetch proposal
        const propUrl = `${SUPABASE_URL}/rest/v1/mcp_propuestas?id=eq.${encodeURIComponent(proposalId)}&select=*`;
        const propOptions = { 
          headers: { 
            apikey: process.env.SUPABASE_SERVICE_KEY, 
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` 
          } 
        };
        
        const propResponse = await fetch(propUrl, propOptions);
        const propData = await propResponse.json();
        
        if (!propResponse.ok) throw new Error(`Failed to load proposal: ${propResponse.status}`);
        if (!Array.isArray(propData) || propData.length === 0) throw new Error('Proposal not found');
        
        const prop = propData[0];
        const { datos_propuestos, tipo, accion } = prop;
        const tablaMap = { noticia: 'noticias', guia: 'guias', curiosidad: 'curiosidades', quiz: 'quiz', otros: 'otros' };
        const tabla = tablaMap[tipo];
        
        let error = null;
        if (accion === 'crear') {
          const createUrl = `${SUPABASE_URL}/rest/v1/${tabla}`;
          const createOptions = { 
            method: 'POST',
            headers: { 
              apikey: process.env.SUPABASE_SERVICE_KEY, 
              Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
              'Content-Type': 'application/json',
              Prefer: 'return=representation'
            },
            body: JSON.stringify(datos_propuestos)
          };
          
          const createResponse = await fetch(createUrl, createOptions);
          error = !createResponse.ok ? await createResponse.text() : null;
        } else if (accion === 'editar' && prop.datos_originales?.id) {
          const updateUrl = `${SUPABASE_URL}/rest/v1/${tabla}?id=eq.${encodeURIComponent(prop.datos_originales.id)}`;
          const updateOptions = { 
            method: 'PATCH',
            headers: { 
              apikey: process.env.SUPABASE_SERVICE_KEY, 
              Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
              'Content-Type': 'application/json',
              Prefer: 'return=representation'
            },
            body: JSON.stringify(datos_propuestos)
          };
          
          const updateResponse = await fetch(updateUrl, updateOptions);
          error = !updateResponse.ok ? await updateResponse.text() : null;
        }
        
        if (error) throw new Error(`Approval failed: ${error}`);
        
        // Update proposal status
        const updateUrl = `${SUPABASE_URL}/rest/v1/mcp_propuestas?id=eq.${encodeURIComponent(proposalId)}`;
        const updateOptions = { 
          method: 'PATCH',
          headers: { 
            apikey: process.env.SUPABASE_SERVICE_KEY, 
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status: 'aprobado', aprobado_en: new Date().toISOString() })
        };
        
        await fetch(updateUrl, updateOptions);
        
        return { content: [{ type: 'text', text: JSON.stringify({ success: true, message: 'Approved and published' }, null, 2) }] };
      }

      case 'reject_content': {
        const { proposalId, reason } = args;
        
        const url = `${SUPABASE_URL}/rest/v1/mcp_propuestas?id=eq.${encodeURIComponent(proposalId)}`;
        const options = { 
          method: 'PATCH',
          headers: { 
            apikey: process.env.SUPABASE_SERVICE_KEY, 
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status: 'rechazado', rechazado_en: new Date().toISOString(), rechazado_motivo: reason })
        };
        
        const response = await fetch(url, options);
        
        if (!response.ok) throw new Error(`Supabase error: ${response.status}`);
        
        return { content: [{ type: 'text', text: JSON.stringify({ success: true, message: 'Rejected' }, null, 2) }] };
      }

      case 'generate_content': {
        const { type, prompt } = args;
        if (!['noticia', 'guia', 'curiosidad', 'quiz', 'otros'].includes(type)) {
          throw new Error(`Invalid type: ${type}`);
        }
        
        // Call the existing OpenAI endpoint
        const res = await fetch(`${process.env.SITE_URL || 'https://minecraft-en-espanol.vercel.app'}/api/generar-mcp-openai`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tipo: type, prompt })
        });
        
        const result = await res.json();
        
        if (!res.ok) throw new Error(result.error || 'Generation failed');
        
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'get_stats': {
        const stats = {};
        for (const [key, table] of Object.entries(TABLES)) {
          const url = `${SUPABASE_URL}/rest/v1/${table.name}?select=*&head`;
          const options = { 
            headers: { 
              apikey: process.env.SUPABASE_SERVICE_KEY, 
              Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` 
            } 
          };
          
          const response = await fetch(url, options);
          // Supabase returns count in Content-Range header when head=true
          const countHeader = response.headers.get('content-range');
          const count = countHeader ? parseInt(countHeader.split('/')[1]) : 0;
          stats[key] = count || 0;
        }
        
        const approvalsUrl = `${SUPABASE_URL}/rest/v1/mcp_propuestas?status=eq.pending&select=*&head`;
        const approvalsOptions = { 
          headers: { 
            apikey: process.env.SUPABASE_SERVICE_KEY, 
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` 
          } 
        };
        
        const approvalsResponse = await fetch(approvalsUrl, approvalsOptions);
        const approvalsHeader = approvalsResponse.headers.get('content-range');
        const approvals = approvalsHeader ? parseInt(approvalsHeader.split('/')[1]) : 0;
        stats.pending_approvals = approvals || 0;
        
        return { content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }] };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    // Return MCP error response format for tool calls
    return { 
      isError: true, 
      content: [{ 
        type: 'text', 
        text: JSON.stringify({
          error: error.message || 'Internal error',
          errorCode: 'TOOL_ERROR'
        }, null, 2) 
      }] 
    };
  }
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  // Auth validation
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ 
      jsonrpc: '2.0', 
      error: { code: -32002, message: 'Unauthorized' }, 
      id: null 
    }), {
      status: 401,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
    });
  }

  const token = authHeader.substring(7);
  if (token !== MCP_API_KEY) {
    return new Response(JSON.stringify({ 
      jsonrpc: '2.0', 
      error: { code: -32002, message: 'Unauthorized' }, 
      id: null 
    }), {
      status: 401,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
    });
  }

  // Rate limiting
  const ip = getClientIP(req);
  const { allowed, remaining, resetMs } = checkRateLimit(ip);

  if (!allowed) {
    return new Response(JSON.stringify({ 
      jsonrpc: '2.0', 
      error: { code: -32003, message: 'Rate limit exceeded' }, 
      id: null 
    }), {
      status: 429,
      headers: { 
        ...corsHeaders(), 
        'Content-Type': 'application/json',
        ...rateLimitHeaders(0, resetMs),
        'Retry-After': String(Math.ceil(resetMs / 1000))
      }
    });
  }

  try {
    const { method, id, params } = await req.json();
    
    // Handle different MCP methods
    if (method === 'initialize') {
      return new Response(JSON.stringify({ 
        jsonrpc: '2.0', 
        id: id || 1,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: {
            name: SERVER_NAME,
            version: SERVER_VERSION
          }
        }
      }), {
        status: 200,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json', ...rateLimitHeaders(remaining, resetMs) }
      });
    }

    if (method === 'tools/list') {
      return new Response(JSON.stringify({ 
        jsonrpc: '2.0', 
        id: id || 2,
        result: {
          tools: [
            {
              name: 'get_content',
              description: 'Get content by type and slug/ID',
              inputSchema: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: Object.keys(TABLES), description: 'Content type' },
                  identifier: { type: 'string', description: 'Slug or ID' },
                },
                required: ['type', 'identifier'],
              },
            },
            {
              name: 'list_content',
              description: 'List content with optional filters',
              inputSchema: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: Object.keys(TABLES), description: 'Content type' },
                  limit: { type: 'number', default: 20, description: 'Max items' },
                  offset: { type: 'number', default: 0 },
                  orderBy: { type: 'string', default: 'created_at.desc' },
                },
                required: ['type'],
              },
            },
            {
              name: 'search_content',
              description: 'Search content by query',
              inputSchema: {
                type: 'object',
                properties: {
                  query: { type: 'string', description: 'Search query' },
                  types: { type: 'array', items: { type: 'string', enum: Object.keys(TABLES) }, description: 'Content types to search' },
                  limit: { type: 'number', default: 10 },
                },
                required: ['query'],
              },
            },
            {
              name: 'create_content',
              description: 'Create new content (saves to Content Approval queue)',
              inputSchema: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: ['noticia', 'guia', 'curiosidad', 'quiz', 'otros'] },
                  data: { type: 'object', description: 'Content data' },
                  metadata: { type: 'object', description: 'Optional metadata' },
                },
                required: ['type', 'data'],
              },
            },
            {
              name: 'update_content',
              description: 'Update existing content',
              inputSchema: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: Object.keys(TABLES) },
                  identifier: { type: 'string', description: 'Slug or ID' },
                  data: { type: 'object', description: 'Fields to update' },
                },
                required: ['type', 'identifier', 'data'],
              },
            },
            {
              name: 'delete_content',
              description: 'Delete content',
              inputSchema: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: Object.keys(TABLES) },
                  identifier: { type: 'string', description: 'Slug or ID' },
                },
                required: ['type', 'identifier'],
              },
            },
            {
              name: 'get_pending_approvals',
              description: 'Get pending content approvals',
              inputSchema: {
                type: 'object',
                properties: {
                  limit: { type: 'number', default: 20 },
                },
              },
            },
            {
              name: 'approve_content',
              description: 'Approve pending content (publishes to live)',
              inputSchema: {
                type: 'object',
                properties: {
                  proposalId: { type: 'string', description: 'Proposal ID from mcp_propuestas' },
                },
                required: ['proposalId'],
              },
            },
            {
              name: 'reject_content',
              description: 'Reject pending content',
              inputSchema: {
                type: 'object',
                properties: {
                  proposalId: { type: 'string', description: 'Proposal ID' },
                  reason: { type: 'string', description: 'Rejection reason' },
                },
                required: ['proposalId'],
              },
            },
            {
              name: 'generate_content',
              description: 'Generate content using AI and queue for approval',
              inputSchema: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: ['noticia', 'guia', 'curiosidad', 'quiz', 'otros'] },
                  prompt: { type: 'string', description: 'Optional custom prompt' },
                },
                required: ['type'],
              },
            },
            {
              name: 'get_stats',
              description: 'Get site statistics',
              inputSchema: {
                type: 'object',
                properties: {},
              },
            },
          ],
        }
      }), {
        status: 200,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json', ...rateLimitHeaders(remaining, resetMs) }
      });
    }

    if (method === 'tools/call') {
      const { name: toolName, arguments: toolArgs } = params || {};
      
      if (!toolName) {
        return new Response(JSON.stringify({ 
          jsonrpc: '2.0', 
          id: id || 3,
          error: { code: -32602, message: 'Invalid params: tool name required' } 
        }), {
          status: 400,
          headers: { ...corsHeaders(), 'Content-Type': 'application/json', ...rateLimitHeaders(remaining, resetMs) }
        });
      }

      const result = await handleTool(toolName, toolArgs);
      
      return new Response(JSON.stringify({ 
        jsonrpc: '2.0', 
        id: id || 3,
        result: result
      }), {
        status: 200,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json', ...rateLimitHeaders(remaining, resetMs) }
      });
    }

    if (method === 'ping') {
      return new Response(JSON.stringify({ 
        jsonrpc: '2.0', 
        id: id || 4,
        result: {
          success: true,
          message: 'MCP server is healthy',
          timestamp: new Date().toISOString(),
          server: SERVER_NAME,
          version: SERVER_VERSION
        }
      }), {
        status: 200,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json', ...rateLimitHeaders(remaining, resetMs) }
      });
    }

    // Method not found
    return new Response(JSON.stringify({ 
      jsonrpc: '2.0', 
      id: id || null,
      error: { code: -32601, message: `Method not found: ${method}` } 
    }), {
      status: 404,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json', ...rateLimitHeaders(remaining, resetMs) }
    });

  } catch (err) {
    // Parse error or internal error
    return new Response(JSON.stringify({ 
      jsonrpc: '2.0', 
      error: { code: -32603, message: 'Failed to parse JSON-RPC request' }, 
      id: null 
    }), {
      status: 400,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
    });
  }
}