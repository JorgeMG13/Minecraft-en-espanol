// api/publicar-programadas.js — publica las noticias programadas cuya hora llegó.
// Autenticación: Bearer $CRON_SECRET (cron externo) o cookie de sesión del panel.
import { publicarProgramadas } from './_lib/publicar.js';
import { cronAutorizado, aplicarCors } from './_lib/node.js';
import { esAdmin, respuesta401 } from './_lib/admin-auth.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!cronAutorizado(req) && !esAdmin(req)) return respuesta401(res);

  try {
    const publicadas = await publicarProgramadas();
    return res.status(200).json({ ok: true, publicadas });
  } catch (err) {
    console.error('Error en publicar-programadas:', err);
    return res.status(500).json({ error: err.message });
  }
}
