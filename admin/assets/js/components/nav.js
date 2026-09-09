// admin/assets/js/components/nav.js — barra lateral compartida del panel.
(function () {
  const ENLACES = [
    { id: 'panel',    href: '/admin/index.html',   texto: '📊 Panel' },
    { id: 'noticias', href: '/admin/noticias.html', texto: '📰 Noticias' },
    { id: 'ia',       href: '/admin/ia.html',       texto: '🤖 Cola IA' },
    { id: 'mensajes', href: '/admin/mensajes.html', texto: '✉️ Mensajes' }
  ];

  /**
   * Renderiza la barra lateral en el elemento #sidebar.
   * @param {string} activo id de la sección activa
   */
  window.AdminNav = function renderNav(activo) {
    const cont = document.getElementById('sidebar');
    if (!cont) return;
    cont.innerHTML = `
      <div class="marca">⛏️ MINECRAFT<br>EN ESPAÑOL<br><span style="color:var(--a-dim)">PANEL</span></div>
      ${ENLACES.map(e =>
        `<a href="${e.href}" class="${e.id === activo ? 'activo' : ''}">${e.texto}</a>`
      ).join('')}
      <a href="/" target="_blank" rel="noopener">🌐 Ver la web</a>
      <div class="pie"><button id="btn-salir" type="button">Cerrar sesión</button></div>`;
    cont.querySelector('#btn-salir').addEventListener('click', async () => {
      try { await window.AdminAPI.logout(); } catch (_) {}
      window.location.href = '/admin/index.html';
    });
  };
})();
