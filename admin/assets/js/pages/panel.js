// admin/assets/js/pages/panel.js — portada del panel: sesión, stats y novedades.
(function () {
  const { esc } = window.MCEDom;
  const { toast } = window.AdminUI;
  const { insigniaEstado } = window.AdminUI;

  function mostrarLogin() {
    document.getElementById('login-pantalla').style.display = 'flex';
    document.getElementById('layout-panel').style.display = 'none';
  }

  function mostrarPanel() {
    document.getElementById('login-pantalla').style.display = 'none';
    document.getElementById('layout-panel').style.display = 'flex';
    AdminNav('panel');
    cargarTodo();
  }

  document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      await AdminAPI.login(document.getElementById('login-password').value);
      mostrarPanel();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.disabled = false;
      document.getElementById('login-password').value = '';
    }
  });

  function tarjetaStat(numero, etiqueta, clase = '') {
    return `<div class="stat ${clase}">
      <div class="numero">${numero === null || numero === undefined ? '–' : numero}</div>
      <div class="etiqueta">${esc(etiqueta)}</div>
    </div>`;
  }

  function filaNoticia(n) {
    const url = `/admin/noticia.html?id=${encodeURIComponent(n.id)}`;
    return `<div class="fila ${esc(n.estado || '')}">
      ${insigniaEstado(n.estado)}
      <div class="titulo-item"><a href="${url}" style="color:inherit;text-decoration:none;">${esc(n.titulo)}</a>
        <div class="slug-linea">/${esc(n.slug || n.id)}</div></div>
      <span class="fecha-item">${esc(n.fecha || '')}</span>
      <div class="acciones"><a class="btn btn-borde btn-mini" href="${url}">✏️ Editar</a></div>
    </div>`;
  }

  function filaMensaje(m) {
    return `<div class="fila ${m.leido ? '' : 'mensaje-no-leido'}">
      <div class="titulo-item">
        ${esc(m.nombre || 'Anónimo')} ${m.email ? `&lt;${esc(m.email)}&gt;` : ''}
        <div class="slug-linea">${esc(m.mensaje)}</div>
      </div>
      <span class="fecha-item">${esc(AdminFormato.fechaCorta(m.created_at))}</span>
    </div>`;
  }

  async function cargarTodo() {
    try {
      // Publica las programadas que ya llegaron a su hora (equivalente al cron)
      AdminAPI.tick().then(r => { if (r && r.publicadas) toast(`📅 ${r.publicadas} noticia(s) programadas publicadas`, 'aviso'); }).catch(() => {});

      const [stats, noticias, mensajes] = await Promise.all([
        AdminAPI.stats(),
        AdminAPI.noticias.listar({ limit: ADMIN_CONFIG.LIMITE_INICIAL }),
        AdminAPI.mensajes.listar({ limit: ADMIN_CONFIG.LIMITE_INICIAL })
      ]);

      document.getElementById('stats-grid').innerHTML = [
        tarjetaStat(stats.noticias.publicadas, 'NOTICIAS PUBLICADAS'),
        tarjetaStat(stats.noticias.borradores, 'BORRADORES'),
        tarjetaStat(stats.colaIa.pendientes, 'IA PENDIENTES', stats.colaIa.pendientes ? 'atencion' : ''),
        tarjetaStat(stats.colaIa.programadas, 'PROGRAMADAS'),
        tarjetaStat(stats.mensajes.noLeidos, 'MENSAJES SIN LEER', stats.mensajes.noLeidos ? 'alerta' : ''),
        tarjetaStat(stats.visitas, 'VISITAS TOTALES')
      ].join('');

      document.getElementById('total-noticias').textContent = `${noticias.total} TOTALES`;
      document.getElementById('total-mensajes').textContent = `${stats.mensajes.noLeidos} SIN LEER`;

      document.getElementById('ultimas-noticias').innerHTML = noticias.items.length
        ? noticias.items.map(filaNoticia).join('')
        : '<div class="vacio">📭 Aún no hay noticias.</div>';

      document.getElementById('ultimos-mensajes').innerHTML = mensajes.items.length
        ? mensajes.items.map(filaMensaje).join('')
        : '<div class="vacio">✉️ Sin mensajes por ahora.</div>';
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  (async function iniciar() {
    try {
      await AdminAPI.sesion();
      mostrarPanel();
    } catch (_) {
      mostrarLogin();
    }
  })();
})();
