// admin/assets/js/pages/mensajes.js — bandeja de mensajes con carga progresiva.
(function () {
  const { esc } = window.MCEDom;
  const { toast, confirmar, botonMas } = window.AdminUI;

  let paginaActual = 1;
  let btnMas = null;

  function fila(m) {
    return `<div class="fila ${m.leido ? '' : 'mensaje-no-leido'}">
      <div class="titulo-item" style="min-width:260px;">
        <strong>${esc(m.nombre || 'Anónimo')}</strong>
        ${m.email ? `<span style="color:var(--a-dim)">&lt;${esc(m.email)}&gt;</span>` : ''}
        <div class="slug-linea" style="white-space:pre-wrap;">${esc(m.mensaje)}</div>
      </div>
      <span class="fecha-item">${esc(AdminFormato.fechaCorta(m.created_at))}</span>
      <div class="acciones">
        <button class="btn ${m.leido ? 'btn-borde' : 'btn-primario'} btn-mini" data-marcar="${esc(m.id)}" data-estado="${m.leido ? '1' : '0'}">
          ${m.leido ? '↩️ Marcar sin leer' : '✓ Marcar leído'}
        </button>
        <button class="btn btn-peligro btn-mini" data-eliminar="${esc(m.id)}">🗑</button>
      </div>
    </div>`;
  }

  async function cargar(pagina = 1, acumular = false) {
    const cont = document.getElementById('lista-mensajes');
    const zonaMas = document.getElementById('zona-mas');
    if (btnMas) { btnMas.remove(); btnMas = null; }
    if (!acumular) cont.innerHTML = '<div class="cargando">CARGANDO…</div>';

    const datos = await AdminAPI.mensajes.listar({
      page: pagina,
      limit: pagina === 1 ? ADMIN_CONFIG.LIMITE_INICIAL : ADMIN_CONFIG.PAGE_SIZE,
      soloNoLeidos: document.getElementById('solo-no-leidos').checked ? '1' : '0'
    });
    paginaActual = datos.page;

    const html = datos.items.map(fila).join('');
    if (acumular) cont.insertAdjacentHTML('beforeend', html);
    else cont.innerHTML = html || '<div class="vacio">✉️ Sin mensajes por ahora.</div>';

    if (datos.hayMas) btnMas = botonMas(zonaMas, `Mostrar más (${datos.total - (datos.items.length * paginaActual)} restantes)`, () => cargar(paginaActual + 1, true));
  }

  document.getElementById('lista-mensajes').addEventListener('click', async (e) => {
    const btnMarcar = e.target.closest('[data-marcar]');
    if (btnMarcar) {
      try {
        await AdminAPI.mensajes.marcar(btnMarcar.dataset.marcar, btnMarcar.dataset.estado !== '1');
        cargar(1);
      } catch (err) { toast(err.message, 'error'); }
      return;
    }
    const btnBorrar = e.target.closest('[data-eliminar]');
    if (btnBorrar) {
      if (!(await confirmar('Eliminar mensaje', '¿Eliminar este mensaje? Esta acción no se puede deshacer.', 'Eliminar'))) return;
      try {
        await AdminAPI.mensajes.eliminar(btnBorrar.dataset.eliminar);
        toast('Mensaje eliminado');
        cargar(1);
      } catch (err) { toast(err.message, 'error'); }
    }
  });

  document.getElementById('solo-no-leidos').addEventListener('change', () => cargar(1));

  AdminNav('mensajes');
  cargar(1).catch(err => toast(err.message, 'error'));
})();
