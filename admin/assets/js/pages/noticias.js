// admin/assets/js/pages/noticias.js — listado con búsqueda y carga progresiva.
(function () {
  const { esc } = window.MCEDom;
  const { toast, confirmar, insigniaEstado, botonMas } = window.AdminUI;

  let paginaActual = 1;
  let total = 0;
  let btnMas = null;

  function fila(n) {
    const editar = `/admin/noticia.html?id=${encodeURIComponent(n.id)}`;
    const publica = `/noticias/${encodeURIComponent(n.slug || n.id)}`;
    return `<div class="fila ${esc(n.estado || '')}">
      ${insigniaEstado(n.estado)}
      <div class="titulo-item">
        <a href="${editar}" style="color:inherit;text-decoration:none;">${esc(n.titulo)}</a>
        <div class="slug-linea">/noticias/${esc(n.slug || n.id)}</div>
      </div>
      <span class="fecha-item">${esc(n.fecha || '')}</span>
      <div class="acciones">
        <a class="btn btn-borde btn-mini" href="${editar}">✏️ Editar</a>
        <a class="btn btn-borde btn-mini" href="${publica}" target="_blank" rel="noopener">👁 Ver</a>
        <button class="btn btn-peligro btn-mini" data-eliminar="${esc(n.id)}" data-titulo="${esc(n.titulo)}">🗑</button>
      </div>
    </div>`;
  }

  async function cargar(pagina = 1, acumular = false) {
    const cont = document.getElementById('lista-noticias');
    const zonaMas = document.getElementById('zona-mas');
    if (btnMas) { btnMas.remove(); btnMas = null; }

    if (!acumular) cont.innerHTML = '<div class="cargando">CARGANDO…</div>';

    const params = {
      page: pagina,
      limit: pagina === 1 ? ADMIN_CONFIG.LIMITE_INICIAL : ADMIN_CONFIG.PAGE_SIZE,
      q: document.getElementById('buscar').value.trim(),
      estado: document.getElementById('filtro-estado').value
    };
    const datos = await AdminAPI.noticias.listar(params);
    total = datos.total;
    paginaActual = datos.page;

    const html = datos.items.map(fila).join('');
    if (acumular) cont.insertAdjacentHTML('beforeend', html);
    else cont.innerHTML = html || '<div class="vacio">Sin resultados para esta búsqueda.</div>';

    if (datos.hayMas) {
      btnMas = botonMas(zonaMas, `Mostrar más (${total - datos.items.length * paginaActual + (datos.items.length * (paginaActual - 1))} restantes)`, () => cargar(paginaActual + 1, true));
    }
  }

  document.getElementById('lista-noticias').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-eliminar]');
    if (!btn) return;
    if (!(await confirmar('Eliminar noticia', `¿Seguro que quieres eliminar "${btn.dataset.titulo}"? Esta acción no se puede deshacer.`, 'Eliminar'))) return;
    try {
      await AdminAPI.noticias.eliminar(btn.dataset.eliminar);
      toast('Noticia eliminada');
      cargar(1);
    } catch (err) { toast(err.message, 'error'); }
  });

  let temporizador;
  document.getElementById('buscar').addEventListener('input', () => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => cargar(1), 350);
  });
  document.getElementById('filtro-estado').addEventListener('change', () => cargar(1));

  AdminNav('noticias');
  cargar(1).catch(err => toast(err.message, 'error'));
})();
