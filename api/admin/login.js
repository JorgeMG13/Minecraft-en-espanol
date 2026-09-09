// api/admin/login.js — autenticación del panel de administración.
// POST {password}  → cookie de sesión firmada (HttpOnly) o 401.
// GET              → ¿hay sesión válida?
// DELETE           → cierra sesión.
import {
  comparacionSegura, esAdmin, cookieSesion, cookieBorrarSesion, demasiadoRapido
} from '../_lib/admin-auth.js';
import { aplicarCors } from '../_lib/node.js';

export default async function handler(req, res) {
  aplicarCors(res, 'GET, POST, DELETE');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    return esAdmin(req)
      ? res.status(200).json({ autenticado: true })
      : res.status(401).json({ autenticado: false });
  }

  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', cookieBorrarSesion());
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'POST') {
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || 'desconocida';
    if (demasiadoRapido(ip)) {
      return res.status(429).json({ error: 'Demasiados intentos. Espera un minuto.' });
    }

    if (!process.env.ADMIN_PASSWORD) {
      return res.status(503).json({
        error: 'El panel no está configurado: define ADMIN_PASSWORD en las variables de entorno de Vercel.'
      });
    }

    const { password } = req.body || {};
    if (!password || !comparacionSegura(password, process.env.ADMIN_PASSWORD)) {
      return res.status(401).json({ error: 'Contraseña incorrecta' });
    }

    res.setHeader('Set-Cookie', cookieSesion());
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
