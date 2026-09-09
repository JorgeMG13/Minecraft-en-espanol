// assets/js/services/supabase.js — capa única de acceso a datos del lado cliente.
// Requiere: supabase-js (CDN) + config.js. Expone window.Servicios.
(function () {
  const { SB_URL, SB_ANON_KEY } = window.MCE_CONFIG;
  const sb = supabase.createClient(SB_URL, SB_ANON_KEY);

  // Columnas con nombres distintos entre tablas
  const TABLAS = {
    noticias:      { img: 'imagen' },
    guias:         { img: 'imagen_url' },
    curiosidades:  { img: null },
    otros:         { img: 'imagen' },
    quiz:          { img: null }
  };

  // Solo `noticias` tiene columna `estado`: en ella solo se muestra lo
  // publicado (o filas antiguas sin estado). Si la columna no existiera,
  // reintenta sin filtrar para mantener compatibilidad.
  function filtroPublicado(tabla) {
    return tabla === 'noticias' ? 'estado.eq.publicada,estado.is.null' : null;
  }

  async function listar(tabla, orden = 'created_at') {
    const f = filtroPublicado(tabla);
    try {
      let q = sb.from(tabla).select('*').order(orden, { ascending: false });
      if (f) q = q.or(f);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    } catch (e) {
      if (f) { // compatibilidad con esquemas antiguos sin `estado`
        try {
          const { data } = await sb.from(tabla).select('*').order(orden, { ascending: false });
          return data || [];
        } catch (_) { return []; }
      }
      return [];
    }
  }

  /** Obtiene un artículo por slug o por id (mantiene URLs antiguas). */
  async function obtener(tabla, idOSlug) {
    if (!idOSlug) return null;
    const f = filtroPublicado(tabla);
    const intentar = async () => {
      let q = sb.from(tabla).select('*');
      q = f ? q.or(f) : q;
      const porSlug = await q.eq('slug', idOSlug).maybeSingle();
      if (porSlug.data) return porSlug.data;
      const pareceId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOSlug);
      if (!pareceId) return null;
      let q2 = sb.from(tabla).select('*');
      q2 = f ? q2.or(f) : q2;
      const porId = await q2.eq('id', idOSlug).maybeSingle();
      return porId.data || null;
    };
    try {
      return await intentar();
    } catch (_) {
      return null;
    }
  }

  async function insertarMensaje({ nombre, email, mensaje }) {
    const { error } = await sb.from('mensajes').insert([{
      nombre: nombre || 'Anónimo',
      email: email || null,
      mensaje
    }]);
    return error || null;
  }

  /** Descarga todas las tablas de la portada en paralelo. */
  async function listarTodo() {
    const [noticias, curiosidades, quiz, otros, guias] = await Promise.all([
      listar('noticias'), listar('curiosidades'), listar('quiz'), listar('otros'), listar('guias')
    ]);
    return { noticia: noticias, curiosidad: curiosidades, quiz, otros, guias };
  }

  /** RPC de registro de visitas (ya existente en el proyecto). */
  async function registrarVisita() {
    const clave = localStorage.getItem('visita_uid') || (() => {
      const u = crypto.randomUUID();
      localStorage.setItem('visita_uid', u);
      return u;
    })();
    try { await sb.rpc('registrar_visita', { p_clave: clave }); } catch (_) {}
  }

  window.Servicios = { sb, TABLAS, listar, obtener, listarTodo, insertarMensaje, registrarVisita, filtroPublicado };
})();
