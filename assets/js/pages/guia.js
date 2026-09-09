// assets/js/pages/guia.js — cuerpo de /guias/:slug (cliente).
(function () {
  const { esc, idDesdeUrl } = window.MCEDom;
  const wrap = document.getElementById('wrap');

  function difClass(d) {
    if (!d) return '';
    d = d.toLowerCase();
    return d.includes('fácil') || d.includes('facil') ? 'dif-facil'
         : d.includes('difícil') || d.includes('dificil') ? 'dif-dificil'
         : 'dif-medio';
  }

  function parsearPasos(p) {
    if (Array.isArray(p)) return p;
    try { return JSON.parse(p || '[]'); } catch (_) { return []; }
  }

  function mostrarError() {
    document.title = 'Guía no encontrada | Minecraft en Español';
    wrap.innerHTML = `
      <div class="not-found">
        <div class="nf-icon">🔍</div>
        <h2>Guía no encontrada</h2>
        <p>El contenido que buscas no existe o fue eliminado.</p>
        <a href="/index.html" class="btn-back">← Volver al inicio</a>
      </div>`;
  }

  async function cargar() {
    const idOSlug = idDesdeUrl();
    if (!idOSlug) { mostrarError(); return; }

    const data = await window.Servicios.obtener('guias', idOSlug);
    if (!data) { mostrarError(); return; }

    document.title = data.titulo + ' | Minecraft en Español';
    document.getElementById('header-label').textContent = '📖 ' + data.titulo;

    const pasos = parsearPasos(data.pasos);

    wrap.innerHTML = `
      ${data.imagen_url ? `<img class="hero-img" src="${esc(data.imagen_url)}" alt="${esc(data.titulo)}" onerror="this.style.display='none'" />` : ''}
      ${data.video_url ? window.MCEVideo.iframe(data.video_url) : ''}
      <div class="art-meta">📖 GUÍA${data.categoria ? ' · ' + esc(data.categoria.toUpperCase()) : ''}</div>
      ${data.dificultad ? `<span class="dif-badge ${difClass(data.dificultad)}">${esc(data.dificultad)}</span>` : ''}
      <h1 class="art-title">${esc(data.titulo)}</h1>
      <div class="steps-label">PASOS (${pasos.length})</div>
      <ol class="steps-list">${pasos.map((p, i) => `<li><span class="step-num">${String(i + 1).padStart(2, '0')}</span><span>${esc(p)}</span></li>`).join('')}</ol>
      ${data.enlace ? `<a class="art-link" href="${esc(data.enlace)}" target="_blank" rel="noopener">🔗 Más información</a>` : ''}
    `;
  }

  cargar();
})();
