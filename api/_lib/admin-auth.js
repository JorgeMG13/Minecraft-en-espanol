// api/_lib/admin-auth.js — autenticación del panel de administración (solo Node).
//
// Modelo: el administrador envía su contraseña a /api/admin/login; si es
// correcta se le entrega una cookie HttpOnly con un token firmado
// (HMAC-SHA256, caducidad incluida). Todas las rutas /api/admin/* verifican
// esa cookie en servidor. El secreto nunca sale del servidor.

import crypto from 'node:crypto';

const COOKIE = 'mce_session';
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

function secreto() {
  return process.env.ADMIN_SESSION_SECRET || process.env.CRON_SECRET || process.env.ADMIN_PASSWORD || '';
}

function hmac(valor) {
  return crypto.createHmac('sha256', secreto()).update(valor).digest('hex');
}

/** Compara dos cadenas en tiempo constante (mitiga ataques de temporización). */
export function comparacionSegura(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/** Crea el valor del token de sesión con caducidad incorporada. */
export function crearToken() {
  const exp = Date.now() + TTL_MS;
  return `${exp}.${hmac(String(exp))}`;
}

/** Valida un token (firma + caducidad). */
export function tokenValido(token) {
  if (!token || !token.includes('.')) return false;
  const [exp, firma] = token.split('.');
  if (!exp || !firma) return false;
  if (Number(exp) <= Date.now()) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(hmac(exp)), Buffer.from(firma));
  } catch (_) {
    return false;
  }
}

function cookiesDe(header) {
  const mapa = {};
  if (!header) return mapa;
  for (const parte of header.split(';')) {
    const i = parte.indexOf('=');
    if (i > 0) mapa[parte.slice(0, i).trim()] = decodeURIComponent(parte.slice(i + 1).trim());
  }
  return mapa;
}

/** ¿La petición presenta una sesión de administrador válida? */
export function esAdmin(req) {
  const cookies = cookiesDe(req.headers.cookie);
  return tokenValido(cookies[COOKIE]);
}

/** Cabecera Set-Cookie para iniciar sesión. */
export function cookieSesion() {
  return `${COOKIE}=${crearToken()}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${TTL_MS / 1000}`;
}

/** Cabecera Set-Cookie para cerrar sesión. */
export function cookieBorrarSesion() {
  return `${COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

/** Limitador básico de intentos por IP (en memoria de la instancia). */
const intentos = new Map();
export function demasiadoRapido(ip, maximo = 8, ventanaMs = 60_000) {
  const ahora = Date.now();
  const reg = intentos.get(ip) || { cuenta: 0, reinicio: ahora + ventanaMs };
  if (ahora > reg.reinicio) { reg.cuenta = 0; reg.reinicio = ahora + ventanaMs; }
  reg.cuenta++;
  intentos.set(ip, reg);
  return reg.cuenta > maximo;
}

/** Respuesta 401 uniforme para las rutas admin. */
export function respuesta401(res) {
  res.status(401).json({ error: 'No autorizado' });
}
