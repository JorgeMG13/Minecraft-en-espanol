// admin/assets/js/pages/ia.js — cola de propuestas IA y programadas.
// La IA nunca publica sola: aquí se revisa, se edita todo y se decide.
(function () {
  const { esc } = window.MCEDom;
  const { toast, confirmar, insigniaEstado, botonMas } = window.AdminUI;

  let paginaActual = 1;
  let btnMas = null;

  function fila(n) {
    const revisar = `/admin/noticia.html?origen=ia&id=${encodeURIComponent(n.id)}`;
    const programada = n.estado === 'programada' && n.publicar_en;
    return `<div class="fila ${esc(n.estado || '')}">
      ${insigniaEstado(n.estado)}
      <div class="titulo-item">
        <a href="${revisar}" style="color:inherit;text-decoration:none;">${esc(n.titulo)}</a>
        <div class="slug-linea">${esc(n.texto || '')}</div>
      </div>
      <span class="fecha-item">${programada ? '📅 ' + esc(AdminFormato.fechaCorta(n.publicar_en)) : esc(AdminFormato.fechaCorta(n.created_at))}</span>
      <div class="acciones">
        <a class="btn btn-primario btn-mini" href="${revisar}">✏️ Revisar y publicar</a>
        <button class="btn btn-peligro btn-mini" data-descartar="${esc(n.id)}" data-titulo="${esc(n.titulo)}">🗑</button>
      </div>
    </div>`;
  }

  async function cargar(pagina = 1, acumular = false) {
    const cont = document.getElementById('lista-ia');
    const zonaMas = document.getElementById('zona-mas');
    if (btnMas) { btnMas.remove(); btnMas = null; }
    if (!acumular) cont.innerHTML = '<div class="cargando">CARGANDO…</div>';

    const datos = await AdminAPI.ia.listar({
      page: pagina,
      limit: pagina === 1 ? ADMIN_CONFIG.LIMITE_INICIAL : ADMIN_CONFIG.PAGE_SIZE,
      estado: document.getElementById('pestaña').value,
      q: document.getElementById('buscar').value.trim()
    });
    paginaActual = datos.page;

    const html = datos.items.map(fila).join('');
    if (acumular) cont.insertAdjacentHTML('beforeend', html);
    else cont.innerHTML = html || '<div class="vacio">No hay propuestas en esta cola. 🎉</div>';

    if (datos.hayMas) btnMas = botonMas(zonaMas, 'Mostrar más', () => cargar(paginaActual + 1, true));
  }

  document.getElementById('lista-ia').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-descartar]');
    if (!btn) return;
    if (!(await confirmar('Descartar propuesta', `¿Descartar "${btn.dataset.titulo}"? No se publicará y se eliminará de la cola.`, 'Descartar'))) return;
    try {
      await AdminAPI.ia.accion(btn.dataset.descartar, 'descartar');
      toast('Propuesta descartada');
      cargar(1);
    } catch (err) { toast(err.message, 'error'); }
  });

  document.getElementById('pestaña').addEventListener('change', () => cargar(1));
  let temporizador;
  document.getElementById('buscar').addEventListener('input', () => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => cargar(1), 350);
  });

  AdminNav('ia');
  cargar(1).catch(err => toast(err.message, 'error'));
})();
