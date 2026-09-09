// api/admin/mensajes.js — gestión de mensajes de usuarios (requiere sesión).
//  GET ?page&limit&soloNoLeidos → listado paginado (los 3 más recientes por defecto)
//  PATCH {id, leido}            → marcar leído / no leído
//  DELETE ?id                   → eliminar
import { clienteSupabase } from '../_lib/node.js';
import { esAdmin, respuesta401 } from '../_lib/admin-auth.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!esAdmin(req)) return respuesta401(res);
  const sb = clienteSupabase();

  try {
    if (req.method === 'GET') {
      const { page = '1', limit = '3', soloNoLeidos = '0' } = req.query;
      const limite = Math.min(Math.max(parseInt(limit, 10) || 3, 1), 50);
      const pagina = Math.max(parseInt(page, 10) || 1, 1);
      const desde = (pagina - 1) * limite;

      let consulta = sb.from('mensajes').select('*', { count: 'exact' }).order('created_at', { ascending: false });
      if (soloNoLeidos === '1') consulta = consulta.eq('leido', false);

      const { data, error, count } = await consulta.range(desde, desde + limite - 1);
      if (error) return res.status(500).json({ error: error.message });

      // Contador de no leídos para la insignia del panel
      const { count: noLeidos } = await sb.from('mensajes').select('id', { count: 'exact', head: true }).eq('leido', false);

      return res.status(200).json({
        items: data || [],
        total: count || 0,
        page: pagina,
        limit: limite,
        noLeidos: noLeidos || 0,
        hayMas: desde + (data?.length || 0) < (count || 0)
      });
    }

    if (req.method === 'PATCH') {
      const { id, leido } = req.body || {};
      if (!id || typeof leido !== 'boolean') return res.status(400).json({ error: 'Faltan id o leido' });
      const { error } = await sb.from('mensajes').update({ leido }).eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'Falta el id' });
      const { error } = await sb.from('mensajes').delete().eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Método no permitido' });
  } catch (err) {
    console.error('admin/mensajes error:', err);
    return res.status(500).json({ error: err.message });
  }
}
