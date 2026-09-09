// api/_lib/slug.js — generación y reserva de slugs amigables.

import { sbGet } from './sb.js';

/** Convierte un título en slug: minúsculas, sin acentos, ñ→n, guiones simples. */
export function slugificar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // quita diacríticos
    .replace(/ñ/gi, 'n')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

/** ¿Existe ya ese slug en la tabla (excluyendo un id al editar)? */
export async function slugOcupado(tabla, slug, excluirId) {
  let q = `${tabla}?select=id&slug=eq.${encodeURIComponent(slug)}&limit=1`;
  if (excluirId) q += `&id=neq.${encodeURIComponent(excluirId)}`;
  const filas = await sbGet(q);
  return Array.isArray(filas) && filas.length > 0;
}

/**
 * Devuelve un slug único para la tabla, probando base, base-2, base-3…
 * (máx. 20 intentos para no encadenar indefinidamente).
 */
export async function slugUnico(tabla, titulo, excluirId) {
  const base = slugificar(titulo) || 'articulo';
  let candidato = base;
  for (let n = 2; n <= 20; n++) {
    if (!(await slugOcupado(tabla, candidato, excluirId))) return candidato;
    candidato = `${base}-${n}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}
