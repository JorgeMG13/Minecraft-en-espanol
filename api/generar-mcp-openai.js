export const config = { runtime: 'edge' };

import { checkRateLimit, getClientIP, corsHeaders, rateLimitHeaders } from './_lib/rate-limit.js';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = 'https://mtkesqoywahieuapftmh.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const ALLOWED_TYPES = ['noticia', 'guia', 'curiosidad', 'quiz', 'otros'];

const PROMPTS = {
  noticia: `Genera una noticia actual de Minecraft en español. Responde SOLO con JSON válido:
{
  "titulo": "string (máx 100 chars)",
  "slug": "string (lowercase, hyphens, max 80 chars)",
  "texto": "string (contenido completo, 3-5 párrafos)",
  "fecha": "DD de MMMM de YYYY",
  "enlace": "url opcional",
  "video_url": "url youtube opcional"
}`,
  
  guia: `Genera una guía práctica de Minecraft en español. Responde SOLO con JSON válido:
{
  "titulo": "string",
  "slug": "string",
  "categoria": "Supervivencia|Exploración|Construcción|Redstone|Jefes",
  "dificultad": "Fácil|Medio|Difícil",
  "pasos": ["paso 1", "paso 2", "paso 3", ...],
  "imagen_url": "url opcional",
  "video_url": "url youtube opcional",
  "enlace": "url opcional"
}`,
  
  curiosidad: `Genera un dato curioso de Minecraft en español. Responde SOLO con JSON válido:
{
  "texto": "string (1-2 párrafos, dato verificado)",
  "fecha": "DD de MMMM de YYYY"
}`,
  
  quiz: `Genera una pregunta de quiz de Minecraft en español. Responde SOLO con JSON válido:
{
  "pregunta": "string",
  "opciones": ["opción A", "opción B", "opción C", "opción D"],
  "correcta": 0,
  "fecha": "DD de MMMM de YYYY"
}`,
  
  otros: `Genera contenido extra de Minecraft (seed, build, redstone, etc.) en español. Responde SOLO con JSON válido:
{
  "titulo": "string opcional",
  "slug": "string",
  "texto": "string (2-3 párrafos)",
  "fecha": "DD de MMMM de YYYY",
  "enlace": "url opcional"
}`
};

function validateSlug(slug) {
  return slug && /^[a-z0-9-]+$/.test(slug) && slug.length <= 80;
}

function validateUUID(id) {
  return id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await req.json();
    const { tipo, accion = 'crear' } = body;

    if (!tipo || !ALLOWED_TYPES.includes(tipo)) {
      return new Response(JSON.stringify({ error: 'Tipo inválido' }), {
        status: 400,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
      });
    }

    // 1. Llamar a OpenAI
    const prompt = PROMPTS[tipo];
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Eres un experto en Minecraft que genera contenido en español para una web de noticias/guías. Responde SOLO con JSON válido, sin markdown ni texto extra.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2000,
        response_format: { type: 'json_object' }
      })
    });

    if (!openaiRes.ok) {
      const err = await openaiRes.text();
      throw new Error(`OpenAI error: ${err}`);
    }

    const openaiData = await openaiRes.json();
    let generatedData;
    
    try {
      generatedData = JSON.parse(openaiData.choices[0].message.content);
    } catch (e) {
      throw new Error('OpenAI returned invalid JSON');
    }

    // 2. Validar y completar datos
    const slug = generatedData.slug || toSlug(generatedData.titulo || generatedData.pregunta || 'contenido');
    if (!validateSlug(slug)) {
      throw new Error('Slug inválido generado por IA');
    }

    const fecha = generatedData.fecha || new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });

    // 3. Insertar en mcp_propuestas
    const tablaMap = { noticia: 'noticias', guia: 'guias', curiosidad: 'curiosidades', quiz: 'quiz', otros: 'otros' };
    const tabla = tablaMap[tipo];

    const proposalData = {
      tipo,
      accion: 'crear',
      datos_propuestos: {
        ...generatedData,
        slug,
        fecha: generatedData.fecha || new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
      },
      metadatos: {
        fuente: 'openai-gpt4o-mini',
        timestamp: new Date().toISOString(),
        confianza: 0.85,
        requiere_revision: true,
        modelo: 'gpt-4o-mini'
      },
      status: 'pending'
    };

    const supabaseRes = await fetch(`${SUPABASE_URL}/rest/v1/mcp_propuestas`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(proposalData)
    });

    if (!supabaseRes.ok) {
      const err = await supabaseRes.text();
      throw new Error(`Supabase error: ${err}`);
    }

    const proposal = await supabaseRes.json();

    return new Response(JSON.stringify({ 
      success: true, 
      proposal: proposal[0],
      message: 'Propuesta creada en MCP Approval' 
    }), {
      status: 201,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Generate MCP error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
    });
  }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': 'https://minecraft-en-espanol.vercel.app',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

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