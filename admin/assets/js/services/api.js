// admin/assets/js/services/api.js — capa única de comunicación con la API admin.
// Todas las peticiones van autenticadas por la cookie de sesión (HttpOnly).
(function () {
  const BASE = window.ADMIN_CONFIG.API_BASE;

  async function peticion(ruta, { metodo = 'GET', cuerpo, params } = {}) {
    let url = `${BASE}/${ruta}`;
    if (params) {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') qs.set(k, v);
      }
      const q = qs.toString();
      if (q) url += `?${q}`;
    }

    const opciones = { method: metodo, credentials: 'same-origin', headers: {} };
    if (cuerpo !== undefined) {
      opciones.headers['Content-Type'] = 'application/json';
      opciones.body = JSON.stringify(cuerpo);
    }

    const res = await fetch(url, opciones);
    let datos = null;
    try { datos = await res.json(); } catch (_) { /* sin cuerpo */ }

    if (res.status === 401 && ruta !== 'login') {
      window.dispatchEvent(new CustomEvent('admin:no-autorizado'));
      throw new Error((datos && datos.error) || 'Sesión expirada');
    }
    if (!res.ok) {
      const err = new Error((datos && datos.error) || `Error ${res.status}`);
      err.sugerencia = datos && datos.sugerencia;
      err.estado = res.status;
      throw err;
    }
    return datos;
  }

  window.AdminAPI = {
    // Sesión
    sesion: () => peticion('login'),
    login: (password) => peticion('login', { metodo: 'POST', cuerpo: { password } }),
    logout: () => peticion('login', { metodo: 'DELETE' }),

    // Noticias publicadas / borradores (`noticias`)
    noticias: {
      listar: (params) => peticion('noticias', { params }),
      obtener: (id) => peticion('noticias', { params: { id } }),
      crear: (campos) => peticion('noticias', { metodo: 'POST', cuerpo: campos }),
      actualizar: (id, campos) => peticion('noticias', { metodo: 'PUT', cuerpo: campos, params: { id } }),
      eliminar: (id) => peticion('noticias', { metodo: 'DELETE', params: { id } })
    },

    // Cola de IA / programadas (`noticias_ia`)
    ia: {
      listar: (params) => peticion('noticias-ia', { params }),
      obtener: (id) => peticion('noticias-ia', { params: { id } }),
      accion: (id, accion, campos = {}, publicarEn) =>
        peticion('noticias-ia', { metodo: 'POST', cuerpo: { id, accion, campos, publicarEn } })
    },

    // Mensajes de usuarios
    mensajes: {
      listar: (params) => peticion('mensajes', { params }),
      marcar: (id, leido) => peticion('mensajes', { metodo: 'PATCH', cuerpo: { id, leido } }),
      eliminar: (id) => peticion('mensajes', { metodo: 'DELETE', params: { id } })
    },

    // Resumen y publicación programada
    stats: () => peticion('stats'),
    tick: () => peticion('tick', { metodo: 'POST' })
  };
})();
