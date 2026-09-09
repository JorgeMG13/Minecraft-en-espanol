// assets/js/pages/curiosidad.js — cuerpo de /curiosidades/:id (cliente).
(function () {
  const { esc, idDesdeUrl } = window.MCEDom;
  const wrap = document.getElementById('wrap');

  function mostrarError() {
    document.title = 'Curiosidad no encontrada | Minecraft en Español';
    wrap.innerHTML = `
      <div class="not-found">
        <div class="nf-icon">🔍</div>
        <h2>Dato curioso no encontrado</h2>
        <p>El contenido que buscas no existe o fue eliminado.</p>
        <a href="/index.html" class="btn-back">← Volver al inicio</a>
      </div>`;
  }

  async function cargar() {
    const id = idDesdeUrl();
    if (!id) { mostrarError(); return; }

    try {
      const { data, error } = await window.Servicios.sb.from('curiosidades').select('*').eq('id', id).single();
      if (error || !data) { mostrarError(); return; }

      document.title = 'Dato curioso | Minecraft en Español';
      document.getElementById('header-label').textContent = '💡 DATO CURIOSO · ' + (data.fecha || '');

      wrap.innerHTML = `
        <div class="curiosidad-block">
          <span class="curiosidad-icon-big">💡</span>
          <div class="art-meta">💡 DATO CURIOSO</div>
          <div class="art-body">${esc(data.texto)}</div>
          <div class="art-date">${esc(data.fecha)}</div>
        </div>`;
    } catch (_) {
      mostrarError();
    }
  }

  cargar();
})();
