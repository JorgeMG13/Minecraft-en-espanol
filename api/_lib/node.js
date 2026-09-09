// api/_lib/node.js — utilidades comunes de las funciones Node (serverless).
// Requiere variables de entorno: SUPABASE_URL, SUPABASE_SERVICE_KEY,
// CRON_SECRET y (solo panel) ADMIN_PASSWORD / ADMIN_SESSION_SECRET.

import { createClient } from '@supabase/supabase-js';

/** Cliente Supabase con service role (solo en servidor; respeta service_key). */
export function clienteSupabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
}

/** Comprueba la cabecera Authorization: Bearer $CRON_SECRET. */
export function cronAutorizado(req) {
  return req.headers['authorization'] === `Bearer ${process.env.CRON_SECRET}`;
}

/** Cabeceras CORS para las funciones que las necesitan. */
export function aplicarCors(res, metodo = 'GET, POST, OPTIONS') {
  res.setHeader('Access-Control-Allow-Origin', 'https://minecraft-en-espanol-admin.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', `${metodo}, OPTIONS`);
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
}

/** Fecha de hoy en es-ES (formato que usa todo el proyecto). */
export function fechaHoyEs() {
  return new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
}

/** Sanitiza un término de búsqueda para PostgREST (evita romper or=…). */
export function limpiarBusqueda(q) {
  return String(q || '').trim().replace(/[,()]/g, '');
}
