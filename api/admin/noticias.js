// api/admin/noticias.js — CRUD de noticias para el panel (requiere sesión).
//  GET ?page&limit&q&estado  → listado paginado con búsqueda por título/slug
//  GET ?id                   → una noticia completa (para el editor)
//  POST {campos}             → crear (slug automático o manual, sin duplicados)
//  PUT  ?id {campos}         → editar (el slug solo cambia si se envía explícito)
//  DELETE ?id                → eliminar
import { clienteSupabase, fechaHoyEs, limpiarBusqueda } from '../_lib/node.js';
import { esAdmin, respuesta401 } from '../_lib/admin-auth.js';
import { slugificar, slugOcupado, slugUnico } from '../_lib/slug.js';

const ESTADOS_VALIDOS = ['publicada', 'pendiente', 'borrador', 'programada'];

function camposPermitidos(body) {
  const out = {};
  if (typeof body.titulo === 'string') out.titulo = body.titulo.trim();
  if (typeof body.texto === 'string') out.texto = body.texto.trim();
  if ('imagen' in body) out.imagen = body.imagen || null;
  if ('enlace' in body) out.enlace = body.enlace || null;
  if ('video_url' in body) out.video_url = body.video_url || null;
  if ('fuente' in body) out.fuente = body.fuente || null;
  if ('fecha' in body) out.fecha = body.fecha || fechaHoyEs();
  if (body.estado && ESTADOS_VALIDOS.includes(body.estado)) out.estado = body.estado;
  return out;
}

function validarCampos(c) {
  if ('titulo' in c && !c.titulo) return 'El título es obligatorio.';
  if ('titulo' in c && c.titulo.length > 200) return 'El título es demasiado largo (máx. 200).';
  if ('texto' in c && !c.texto) return 'El contenido es obligatorio.';
  for (const campo of ['imagen', 'enlace', 'video_url']) {
    if (c[campo]) {
      try { new URL(c[campo]); } catch (_) { return `El campo ${campo} debe ser una URL válida.`; }
    }
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!esAdmin(req)) return respuesta401(res);
  const sb = clienteSupabase();

  try {
    // ── LISTADO / LECTURA ──────────────────────────────────────────
    if (req.method === 'GET') {
      const { id, page = '1', limit = '3', q = '', estado = 'todos' } = req.query;

      if (id) {
        const { data, error } = await sb.from('noticias').select('*').eq('id', id).single();
        if (error) return res.status(404).json({ error: 'Noticia no encontrada' });
        return res.status(200).json(data);
      }

      const limite = Math.min(Math.max(parseInt(limit, 10) || 3, 1), 50);
      const pagina = Math.max(parseInt(page, 10) || 1, 1);
      const desde = (pagina - 1) * limite;

      let consulta = sb.from('noticias').select('*', { count: 'exact' }).order('created_at', { ascending: false });
      if (estado !== 'todos' && ESTADOS_VALIDOS.includes(estado)) consulta = consulta.eq('estado', estado);

      const texto = limpiarBusqueda(q);
      if (texto) consulta = consulta.or(`titulo.ilike.%${texto}%,slug.ilike.%${texto}%`);

      const { data, error, count } = await consulta.range(desde, desde + limite - 1);
      if (error) return res.status(500).json({ error: error.message });

      return res.status(200).json({
        items: data || [],
        total: count || 0,
        page: pagina,
        limit: limite,
        hayMas: desde + (data?.length || 0) < (count || 0)
      });
    }

    // ── CREAR ─────────────────────────────────────────────────────
    if (req.method === 'POST') {
      const campos = camposPermitidos(req.body || {});
      const errorValidacion = validarCampos(campos);
      if (errorValidacion) return res.status(400).json({ error: errorValidacion });
      if (!campos.titulo || !campos.texto) return res.status(400).json({ error: 'Título y contenido son obligatorios.' });

      let slug;
      if (req.body.slug && req.body.slug.trim()) {
        slug = slugificar(req.body.slug);
        if (await slugOcupado('noticias', slug)) {
          return res.status(409).json({ error: `El slug "${slug}" ya está en uso.`, sugerencia: await slugUnico('noticias', slug) });
        }
      } else {
        slug = await slugUnico('noticias', campos.titulo);
      }

      const fila = {
        ...campos,
        slug,
        estado: campos.estado || 'borrador',
        fecha: campos.fecha || fechaHoyEs()
      };
      const { data, error } = await sb.from('noticias').insert(fila).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(201).json(data);
    }

    // ── EDITAR ────────────────────────────────────────────────────
    if (req.method === 'PUT') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'Falta el id' });

      const campos = camposPermitidos(req.body || {});
      const errorValidacion = validarCampos(campos);
      if (errorValidacion) return res.status(400).json({ error: errorValidacion });

      // El slug solo cambia si el administrador lo edita explícitamente.
      const slugEnviado = (req.body.slug || '').trim();
      if (slugEnviado) {
        const slug = slugificar(slugEnviado);
        if (await slugOcupado('noticias', slug, id)) {
          return res.status(409).json({ error: `El slug "${slug}" ya está en uso.`, sugerencia: await slugUnico('noticias', slug) });
        }
        campos.slug = slug;
      }

      if (!Object.keys(campos).length) return res.status(400).json({ error: 'Nada que actualizar.' });

      const { data, error } = await sb.from('noticias').update(campos).eq('id', id).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data);
    }

    // ── ELIMINAR ──────────────────────────────────────────────────
    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'Falta el id' });
      const { error } = await sb.from('noticias').delete().eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Método no permitido' });
  } catch (err) {
    console.error('admin/noticias error:', err);
    return res.status(500).json({ error: err.message });
  }
}
