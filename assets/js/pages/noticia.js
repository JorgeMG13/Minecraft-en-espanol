// assets/js/pages/noticia.js — cuerpo de /noticias/:slug (cliente).
(function () {
  const { esc, idDesdeUrl } = window.MCEDom;
  const wrap = document.getElementById('wrap');

  function mostrarError() {
    document.title = 'Noticia no encontrada | Minecraft en Español';
    wrap.innerHTML = `
      <div class="not-found">
        <div class="nf-icon">🔍</div>
        <h2>Noticia no encontrada</h2>
        <p>El artículo que buscas no existe o fue eliminado.</p>
        <a href="/index.html" class="btn-back">← Volver al inicio</a>
      </div>`;
  }

  async function cargar() {
    const idOSlug = idDesdeUrl();
    if (!idOSlug) { mostrarError(); return; }

    const data = await window.Servicios.obtener('noticias', idOSlug);
    if (!data) { mostrarError(); return; }

    document.title = data.titulo + ' | Minecraft en Español';
    document.getElementById('header-label').textContent = '📰 ' + data.titulo;

    wrap.innerHTML = `
      ${data.imagen ? `<img class="hero-img" src="${esc(data.imagen)}" alt="${esc(data.titulo)}" onerror="this.style.display='none'" />` : ''}
      ${data.video_url ? window.MCEVideo.iframe(data.video_url) : ''}
      <div class="art-meta">📰 NOTICIA</div>
      <h1 class="art-title">${esc(data.titulo)}</h1>
      <div class="art-date">${esc(data.fecha)}</div>
      <div class="art-body">${esc(data.texto)}</div>
      ${data.enlace ? `<a class="art-link" href="${esc(data.enlace)}" target="_blank" rel="noopener">🔗 Más información</a>` : ''}
    `;
  }

  cargar();
})();
