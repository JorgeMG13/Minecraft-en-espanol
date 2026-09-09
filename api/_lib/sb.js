// api/_lib/sb.js — cliente REST de Supabase (PostgREST) para funciones edge.
// Solo usa fetch global: no importa paquetes npm (requisito del runtime edge).

import { SB_URL, SB_ANON_KEY } from './config.js';

const CABECERAS = { apikey: SB_ANON_KEY, Authorization: `Bearer ${SB_ANON_KEY}` };

/** GET genérico a PostgREST. Devuelve JSON o [] en caso de error. */
export async function sbGet(recurso) {
  try {
    const res = await fetch(`${SB_URL}/rest/v1/${recurso}`, { headers: CABECERAS });
    const data = await res.json();
    return data;
  } catch (_) {
    return [];
  }
}

/**
 * Lista registros de una tabla con filtro de estado público:
 * solo `publicada` o filas antiguas sin estado (null).
 * Si la columna estado no existiera aún, reintenta sin filtrar.
 */
export async function listarPublicos(tabla, { select = '*', orden = 'created_at.desc', limite, desde } = {}) {
  const params = new URLSearchParams({ select, order: orden });
  if (limite) params.set('limit', String(limite));
  if (desde) params.set('offset', String(desde));
  let filas = await sbGet(`${tabla}?${params}&or=(estado.eq.publicada,estado.is.null)`);
  if (!Array.isArray(filas)) filas = [];
  if (filas.length === 0) {
    // Compatibilidad: reintenta sin el filtro de estado (esquema antiguo)
    filas = await sbGet(`${tabla}?${params}`);
    if (!Array.isArray(filas)) filas = [];
  }
  return filas;
}

/** Cuenta registros públicos de una tabla (Content-Range). */
export async function contarPublicos(tabla, { orden = 'created_at.desc' } = {}) {
  try {
    const res = await fetch(
      `${SB_URL}/rest/v1/${tabla}?select=id&order=${orden}&or=(estado.eq.publicada,estado.is.null)&limit=1`,
      { headers: { ...CABECERAS, Prefer: 'count=exact' } }
    );
    const rango = res.headers.get('content-range') || '*/0';
    const total = parseInt(rango.split('/')[1], 10);
    return Number.isFinite(total) ? total : 0;
  } catch (_) {
    return 0;
  }
}

/**
 * Obtiene un artículo por slug o por id (compatibilidad con URLs antiguas).
 * 1) Intenta por slug. 2) Si el valor parece un id (uuid o número), intenta por id.
 * Filtra por estado público salvo en tablas sin columna estado (curiosidades).
 */
export async function obtenerArticulo(tabla, idOSlug, columnas = '*') {
  if (!idOSlug) return null;
  const conEstado = tabla !== 'curiosidades';
  const filtroEstado = conEstado ? `&or=(estado.eq.publicada,estado.is.null)` : '';

  let filas = await sbGet(
    `${tabla}?select=${columnas}&slug=eq.${encodeURIComponent(idOSlug)}${filtroEstado}&limit=1`
  );
  if (Array.isArray(filas) && filas[0]) return filas[0];

  const pareceId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOSlug) ||
                   /^\d+$/.test(idOSlug);
  if (pareceId) {
    filas = await sbGet(`${tabla}?select=${columnas}&id=eq.${encodeURIComponent(idOSlug)}${filtroEstado}&limit=1`);
    if (Array.isArray(filas) && filas[0]) return filas[0];
  }
  return null;
}

/** Obtiene un artículo por id sin filtro de estado (uso interno/admin). */
export async function obtenerPorId(tabla, id, columnas = '*') {
  if (!id) return null;
  const filas = await sbGet(`${tabla}?select=${columnas}&id=eq.${encodeURIComponent(id)}&limit=1`);
  return Array.isArray(filas) && filas[0] ? filas[0] : null;
}
