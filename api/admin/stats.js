// api/admin/stats.js — resumen de estado del sitio (requiere sesión).
// Solo utiliza datos que existen realmente en el proyecto:
// noticias (por estado), cola IA, mensajes (no leídos) y visitas (RPC existente).
import { clienteSupabase } from '../_lib/node.js';
import { esAdmin, respuesta401 } from '../_lib/admin-auth.js';

async function contar(sb, tabla, filtros = {}) {
  let consulta = sb.from(tabla).select('id', { count: 'exact', head: true });
  for (const [columna, valor] of Object.entries(filtros)) consulta = consulta.eq(columna, valor);
  const { count, error } = await consulta;
  return error ? null : (count || 0);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!esAdmin(req)) return respuesta401(res);
  const sb = clienteSupabase();

  try {
    const [publicadas, borradores, pendientes, iaProgramadas, iaPendientes, mensajes, mensajesNoLeidos] = await Promise.all([
      contar(sb, 'noticias', { estado: 'publicada' }),
      contar(sb, 'noticias', { estado: 'borrador' }),
      contar(sb, 'noticias', { estado: 'pendiente' }),
      contar(sb, 'noticias_ia', { estado: 'programada' }),
      contar(sb, 'noticias_ia', { estado: 'pendiente' }),
      contar(sb, 'mensajes'),
      contar(sb, 'mensajes', { leido: false })
    ]);

    // Visitas totales: tabla `visitas` (id, conut) alimentada por el RPC registrar_visita
    let visitas = null;
    const { data } = await sb.from('visitas').select('conut').limit(1);
    if (Array.isArray(data) && data[0]) visitas = data[0].conut;

    return res.status(200).json({
      noticias: { publicadas, borradores, pendientes },
      colaIa: { pendientes: iaPendientes, programadas: iaProgramadas },
      mensajes: { total: mensajes, noLeidos: mensajesNoLeidos },
      visitas
    });
  } catch (err) {
    console.error('admin/stats error:', err);
    return res.status(500).json({ error: err.message });
  }
}
