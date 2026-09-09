// api/_lib/publicar.js — lógica de publicación programada (solo Node).
// Usada por /api/publicar-programadas (cron externo) y /api/admin/tick (panel).

import { createClient } from '@supabase/supabase-js';
import { slugUnico } from './slug.js';

function cliente() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
}

function fechaHoyEs() {
  return new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
}

/**
 * Publica las noticias de `noticias_ia` con estado='programada' cuya
 * fecha (publicar_en) ya ha llegado. Genera slug si falta.
 * Devuelve el número de noticias publicadas.
 */
export async function publicarProgramadas() {
  const sb = cliente();
  const ahora = new Date().toISOString();

  const { data: pendientes, error: errBuscar } = await sb
    .from('noticias_ia')
    .select('*')
    .eq('estado', 'programada')
    .lte('publicar_en', ahora);

  if (errBuscar) throw errBuscar;
  if (!pendientes || !pendientes.length) return 0;

  let publicadas = 0;
  for (const n of pendientes) {
    const slug = await slugUnico('noticias', n.titulo);
    const { error: errInsert } = await sb.from('noticias').insert({
      titulo: n.titulo,
      texto: n.texto,
      enlace: n.enlace || null,
      imagen: n.imagen || null,
      fecha: n.fecha || fechaHoyEs(),
      slug,
    });
    if (errInsert) throw errInsert;

    const { error: errBorrar } = await sb.from('noticias_ia').delete().eq('id', n.id);
    if (errBorrar) throw errBorrar;
    publicadas++;
  }
  return publicadas;
}
