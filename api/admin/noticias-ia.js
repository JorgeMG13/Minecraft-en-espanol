// api/admin/noticias-ia.js — gestión de la cola de IA (`noticias_ia`).
//  GET ?page&limit&estado& q → propuestas pendientes/programadas paginadas
//  POST {id, accion, campos} →
//    publicar  : aplica los campos, genera slug único e inserta en `noticias`
//    programar : guarda campos + publicar_en (ISO) y marca estado='programada'
//    guardar   : guarda campos sin cambiar estado
//    descartar : elimina la propuesta
// La IA nunca publica sola: toda publicación pasa por aquí (sesión admin).
import { clienteSupabase, fechaHoyEs, limpiarBusqueda } from '../_lib/node.js';
import { esAdmin, respuesta401 } from '../_lib/admin-auth.js';
import { slugificar, slugOcupado, slugUnico } from '../_lib/slug.js';

const ESTADOS_VALIDOS = ['pendiente', 'programada'];

function camposPermitidos(body) {
  const out = {};
  if (typeof body.titulo === 'string') out.titulo = body.titulo.trim();
  if (typeof body.texto === 'string') out.texto = body.texto.trim();
  if ('imagen' in body) out.imagen = body.imagen || null;
  if ('enlace' in body) out.enlace = body.enlace || null;
  if ('video_url' in body) out.video_url = body.video_url || null;
  if ('fuente' in body) out.fuente = body.fuente || null;
  if ('fecha' in body) out.fecha = body.fecha || fechaHoyEs();
  return out;
}

function validarCampos(c) {
  if ('titulo' in c && !c.titulo) return 'El título es obligatorio.';
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
    if (req.method === 'GET') {
      const { id, page = '1', limit = '3', q = '', estado = 'todos' } = req.query;

      if (id) {
        const { data, error } = await sb.from('noticias_ia').select('*').eq('id', id).single();
        if (error) return res.status(404).json({ error: 'Propuesta no encontrada' });
        return res.status(200).json(data);
      }

      const limite = Math.min(Math.max(parseInt(limit, 10) || 3, 1), 50);
      const pagina = Math.max(parseInt(page, 10) || 1, 1);
      const desde = (pagina - 1) * limite;

      let consulta = sb.from('noticias_ia').select('*', { count: 'exact' }).order('created_at', { ascending: false });
      if (estado !== 'todos' && ESTADOS_VALIDOS.includes(estado)) consulta = consulta.eq('estado', estado);

      const texto = limpiarBusqueda(q);
      if (texto) consulta = consulta.or(`titulo.ilike.%${texto}%,texto.ilike.%${texto}%`);

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

    if (req.method === 'POST') {
      const { id, accion, campos: camposEntrada = {}, publicarEn } = req.body || {};
      if (!accion) return res.status(400).json({ error: 'Falta la acción' });

      // Programar sin id = crear una nueva propuesta programada
      // (publicación manual con fecha/hora; vive en la cola hasta su hora).
      if (accion === 'programar' && !id) {
        const camposNuevos = camposPermitidos(camposEntrada);
        const errValidacion = validarCampos(camposNuevos);
        if (errValidacion) return res.status(400).json({ error: errValidacion });
        if (!camposNuevos.titulo || !camposNuevos.texto) {
          return res.status(400).json({ error: 'Título y contenido son obligatorios.' });
        }
        if (!publicarEn) return res.status(400).json({ error: 'Falta la fecha de publicación (publicar_en).' });
        const cuando = new Date(publicarEn);
        if (isNaN(cuando.getTime())) return res.status(400).json({ error: 'Fecha inválida.' });

        const { error } = await sb.from('noticias_ia').insert({
          ...camposNuevos,
          estado: 'programada',
          fuente: camposNuevos.fuente || 'Panel',
          publicar_en: cuando.toISOString()
        });
        if (error) return res.status(500).json({ error: error.message });
        return res.status(201).json({ ok: true, accion });
      }

      if (!id) return res.status(400).json({ error: 'Falta el id' });

      const { data: propuesta, error: errGet } = await sb.from('noticias_ia').select('*').eq('id', id).single();
      if (errGet || !propuesta) return res.status(404).json({ error: 'Propuesta no encontrada' });

      const campos = camposPermitidos(camposEntrada);
      const errorValidacion = validarCampos(campos);
      if (errorValidacion) return res.status(400).json({ error: errorValidacion });

      // ── PUBLICAR ────────────────────────────────────────────────
      if (accion === 'publicar') {
        const final = {
          titulo: campos.titulo ?? propuesta.titulo,
          texto: campos.texto ?? propuesta.texto,
          imagen: campos.imagen ?? propuesta.imagen,
          enlace: campos.enlace ?? propuesta.enlace,
          video_url: campos.video_url ?? null,
          fuente: campos.fuente ?? propuesta.fuente,
          fecha: campos.fecha ?? propuesta.fecha ?? fechaHoyEs(),
          estado: 'publicada'
        };
        if (!final.titulo || !final.texto) return res.status(400).json({ error: 'Título y contenido son obligatorios.' });

        const slugEnviado = (camposEntrada.slug || '').trim();
        const slug = slugEnviado
          ? slugificar(slugEnviado)
          : await slugUnico('noticias', final.titulo);
        if (await slugOcupado('noticias', slug)) {
          return res.status(409).json({ error: `El slug "${slug}" ya está en uso.`, sugerencia: await slugUnico('noticias', slug) });
        }

        const { data: publicada, error: errInsert } = await sb
          .from('noticias').insert({ ...final, slug }).select().single();
        if (errInsert) return res.status(500).json({ error: errInsert.message });

        await sb.from('noticias_ia').delete().eq('id', id);
        return res.status(200).json({ ok: true, accion, noticia: publicada });
      }

      // ── PROGRAMAR ───────────────────────────────────────────────
      if (accion === 'programar') {
        if (!publicarEn) return res.status(400).json({ error: 'Falta la fecha de publicación (publicar_en).' });
        const cuando = new Date(publicarEn);
        if (isNaN(cuando.getTime())) return res.status(400).json({ error: 'Fecha inválida.' });

        const { error } = await sb.from('noticias_ia')
          .update({ ...campos, estado: 'programada', publicar_en: cuando.toISOString() })
          .eq('id', id);
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ ok: true, accion });
      }

      // ── GUARDAR CAMBIOS ─────────────────────────────────────────
      if (accion === 'guardar') {
        if (!Object.keys(campos).length) return res.status(400).json({ error: 'Nada que guardar.' });
        const { error } = await sb.from('noticias_ia').update(campos).eq('id', id);
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ ok: true, accion });
      }

      // ── DESCARTAR ───────────────────────────────────────────────
      if (accion === 'descartar') {
        const { error } = await sb.from('noticias_ia').delete().eq('id', id);
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ ok: true, accion });
      }

      return res.status(400).json({ error: 'Acción no reconocida' });
    }

    return res.status(405).json({ error: 'Método no permitido' });
  } catch (err) {
    console.error('admin/noticias-ia error:', err);
    return res.status(500).json({ error: err.message });
  }
}
