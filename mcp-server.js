#!/usr/bin/env node
/**
 * MCP Server for Minecraft en Español
 * Exposes web app functionality as MCP tools for AI assistants
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://mtkesqoywahieuapftmh.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('SUPABASE_SERVICE_KEY required');
  process.exit(1);
}

const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const sbAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY || '');

const server = new Server(
  {
    name: 'minecraft-en-espanol',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const TABLES = {
  noticias: { name: 'noticias', slugField: 'slug', titleField: 'titulo' },
  guias: { name: 'guias', slugField: 'slug', titleField: 'titulo' },
  curiosidades: { name: 'curiosidades', slugField: 'id', titleField: 'texto' },
  quiz: { name: 'quiz', slugField: 'id', titleField: 'pregunta' },
  otros: { name: 'otros', slugField: 'slug', titleField: 'titulo' },
  mensajes: { name: 'mensajes', slugField: 'id', titleField: 'nombre' },
};

function toSlug(str) {
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // Content reading tools
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
      // Content management tools
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
      // Approval workflow tools
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
      // AI Generation
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
      // Stats
      {
        name: 'get_stats',
        description: 'Get site statistics',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'get_content': {
        const { type, identifier } = args;
        const table = TABLES[type];
        const field = identifier.includes('-') && identifier.length > 20 ? 'id' : table.slugField;
        const { data, error } = await sbAdmin
          .from(table.name)
          .select('*')
          .eq(field, identifier)
          .single();
        if (error) throw new McpError(ErrorCode.InternalError, error.message);
        if (!data) throw new McpError(ErrorCode.InvalidParams, `Not found: ${type}/${identifier}`);
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }

      case 'list_content': {
        const { type, limit = 20, offset = 0, orderBy = 'created_at.desc' } = args;
        const table = TABLES[type];
        const { data, error } = await sbAdmin
          .from(table.name)
          .select('*')
          .order(orderBy.split('.')[0], { ascending: orderBy.endsWith('.asc') })
          .range(offset, offset + limit - 1);
        if (error) throw new McpError(ErrorCode.InternalError, error.message);
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }

      case 'search_content': {
        const { query, types = Object.keys(TABLES), limit = 10 } = args;
        // Simple search across multiple tables
        const results = [];
        for (const type of types) {
          const table = TABLES[type];
          const searchFields = type === 'quiz' ? 'pregunta' : (table.titleField || 'titulo');
          const { data, error } = await sbAdmin
            .from(table.name)
            .select('*')
            .ilike(searchFields, `%${query}%`)
            .limit(limit);
          if (error) continue;
          if (data?.length) results.push(...data.map(d => ({ ...d, _type: type })));
        }
        return { content: [{ type: 'text', text: JSON.stringify(results.slice(0, limit), null, 2) }] };
      }

      case 'create_content': {
        const { type, data, metadata = {} } = args;
        if (!['noticia', 'guia', 'curiosidad', 'quiz', 'otros'].includes(type)) {
          throw new McpError(ErrorCode.InvalidParams, `Invalid type for creation: ${type}`);
        }
        const tableMap = { noticia: 'noticias', guia: 'guias', curiosidad: 'curiosidades', quiz: 'quiz', otros: 'otros' };
        const table = tableMap[type];

        // Generate slug if not provided
        const titleField = type === 'quiz' ? 'pregunta' : 'titulo';
        const slug = data.slug || toSlug(data[titleField] || data.texto?.slice(0, 50) || 'contenido');

        const proposal = {
          tipo: type,
          accion: 'crear',
          datos_propuestos: { ...data, slug },
          metadatos: {
            fuente: 'mcp-client',
            timestamp: new Date().toISOString(),
            confianza: 0.9,
            ...metadata
          },
          status: 'pending'
        };

        const { data, error } = await sbAdmin
          .from('mcp_propuestas')
          .insert(proposal)
          .select()
          .single();
        if (error) throw new McpError(ErrorCode.InternalError, error.message);
        return { content: [{ type: 'text', text: JSON.stringify({ success: true, proposal: data }, null, 2) }] };
      }

      case 'update_content': {
        const { type, identifier, data } = args;
        const table = TABLES[type];
        const field = identifier.includes('-') && identifier.length > 20 ? 'id' : table.slugField;
        const { error } = await sbAdmin
          .from(table.name)
          .update(data)
          .eq(field, identifier);
        if (error) throw new McpError(ErrorCode.InternalError, error.message);
        return { content: [{ type: 'text', text: JSON.stringify({ success: true }, null, 2) }] };
      }

      case 'delete_content': {
        const { type, identifier } = args;
        const table = TABLES[type];
        const field = identifier.includes('-') && identifier.length > 20 ? 'id' : table.slugField;
        const { error } = await sbAdmin.from(table.name).delete().eq(field, identifier);
        if (error) throw new McpError(ErrorCode.InternalError, error.message);
        return { content: [{ type: 'text', text: JSON.stringify({ success: true }, null, 2) }] };
      }

      case 'get_pending_approvals': {
        const { limit = 20 } = args;
        const { data, error } = await sbAdmin
          .from('mcp_propuestas')
          .select('*')
          .eq('status', 'pending')
          .order('creado_en', { ascending: false })
          .limit(limit);
        if (error) throw new McpError(ErrorCode.InternalError, error.message);
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }

      case 'approve_content': {
        const { proposalId } = args;
        const { data: prop, error: errLoad } = await sbAdmin
          .from('mcp_propuestas')
          .select('*')
          .eq('id', proposalId)
          .single();
        if (errLoad) throw new McpError(ErrorCode.InvalidParams, 'Proposal not found');

        const { datos_propuestos, tipo, accion } = prop;
        const tablaMap = { noticia: 'noticias', guia: 'guias', curiosidad: 'curiosidades', quiz: 'quiz', otros: 'otros' };
        const tabla = tablaMap[tipo];

        let error = null;
        if (accion === 'crear') {
          const { error: errIns } = await sbAdmin.from(tabla).insert(datos_propuestos);
          error = errIns;
        } else if (accion === 'editar' && prop.datos_originales?.id) {
          const { error: errUpd } = await sbAdmin.from(tabla).update(prop.datos_propuestos).eq('id', prop.datos_originales.id);
          error = errUpd;
        }
        if (error) throw new McpError(ErrorCode.InternalError, error.message);

        await sbAdmin.from('mcp_propuestas').update({ status: 'aprobado', aprobado_en: new Date().toISOString() }).eq('id', proposalId);
        return { content: [{ type: 'text', text: JSON.stringify({ success: true, message: 'Approved and published' }, null, 2) }] };
      }

      case 'reject_content': {
        const { proposalId, reason } = args;
        const { error } = await sbAdmin
          .from('mcp_propuestas')
          .update({ status: 'rechazado', rechazado_en: new Date().toISOString(), rechazado_motivo: reason })
          .eq('id', proposalId);
        if (error) throw new McpError(ErrorCode.InternalError, error.message);
        return { content: [{ type: 'text', text: JSON.stringify({ success: true, message: 'Rejected' }, null, 2) }] };
      }

      case 'generate_content': {
        const { type, prompt } = args;
        if (!['noticia', 'guia', 'curiosidad', 'quiz', 'otros'].includes(type)) {
          throw new McpError(ErrorCode.InvalidParams, `Invalid type: ${type}`);
        }
        // This would call the OpenAI endpoint
        const res = await fetch(`${process.env.SITE_URL || 'https://minecraft-en-espanol.vercel.app'}/api/generar-mcp-openai`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tipo: type, prompt })
        });
        const result = await res.json();
        if (!res.ok) throw new McpError(ErrorCode.InternalError, result.error || 'Generation failed');
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'get_stats': {
        const stats = {};
        for (const [key, table] of Object.entries(TABLES)) {
          const { count } = await sbAdmin.from(table.name).select('*', { count: 'exact', head: true });
          stats[key] = count || 0;
        }
        const { count: approvals } = await sbAdmin.from('mcp_propuestas').select('*', { count: 'exact', head: true }).eq('status', 'pending');
        stats.pending_approvals = approvals || 0;
        return { content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }] };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (error) {
    if (error instanceof McpError) throw error;
    throw new McpError(ErrorCode.InternalError, error.message);
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('MCP Server running on stdio');