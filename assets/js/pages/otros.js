// assets/js/pages/otros.js — cuerpo de /otros/:slug (cliente).
(function () {
  const { esc, idDesdeUrl } = window.MCEDom;
  const wrap = document.getElementById('wrap');

  function mostrarError() {
    document.title = 'Contenido no encontrado | Minecraft en Español';
    wrap.innerHTML = `
      <div class="not-found">
        <div class="nf-icon">🔍</div>
        <h2>Contenido no encontrado</h2>
        <p>El contenido que buscas no existe o fue eliminado.</p>
        <a href="/index.html" class="btn-back">← Volver al inicio</a>
      </div>`;
  }

  async function cargar() {
    const idOSlug = idDesdeUrl();
    if (!idOSlug) { mostrarError(); return; }

    const data = await window.Servicios.obtener('otros', idOSlug);
    if (!data) { mostrarError(); return; }

    document.title = (data.titulo || 'Contenido extra') + ' | Minecraft en Español';
    document.getElementById('header-label').textContent = '🎭 ' + (data.titulo || 'OTROS');

    wrap.innerHTML = `
      <div class="art-meta">🎭 OTROS</div>
      ${data.titulo ? `<h1 class="art-title">${esc(data.titulo)}</h1>` : ''}
      <div class="art-date">${esc(data.fecha)}</div>
      <div class="art-body">${esc(data.texto)}</div>
      ${data.enlace ? `<a class="art-link" href="${esc(data.enlace)}" target="_blank" rel="noopener">🔗 Más información</a>` : ''}
    `;
  }

  cargar();
})();
