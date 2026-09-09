// api/admin/tick.js — publica las noticias programadas que ya llegaron a su hora.
// Lo invoca el panel al abrirse; reutiliza la misma lógica que el cron externo.
import { publicarProgramadas } from '../_lib/publicar.js';
import { esAdmin, respuesta401 } from '../_lib/admin-auth.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!esAdmin(req)) return respuesta401(res);

  try {
    const publicadas = await publicarProgramadas();
    return res.status(200).json({ ok: true, publicadas });
  } catch (err) {
    console.error('admin/tick error:', err);
    return res.status(500).json({ error: err.message });
  }
}
