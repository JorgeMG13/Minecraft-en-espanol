// admin/assets/js/components/ui.js — componentes de interfaz reutilizables.
(function () {
  const { esc } = window.MCEDom;

  /** Toast de feedback. tipo: 'ok' | 'error' | 'aviso' */
  function toast(mensaje, tipo = 'ok', ms = 3200) {
    let el = document.getElementById('admin-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'admin-toast';
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = mensaje;
    el.className = `toast visible ${tipo === 'ok' ? '' : tipo}`;
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('visible'), ms);
  }

  /** Modal de confirmación con promesa. */
  function confirmar(titulo, texto, boton = 'Confirmar') {
    return new Promise((resolver) => {
      let fondo = document.getElementById('admin-confirm');
      if (!fondo) {
        fondo = document.createElement('div');
        fondo.id = 'admin-confirm';
        fondo.className = 'modal-fondo';
        fondo.innerHTML = `
          <div class="modal-caja" style="max-width:460px">
            <h3 id="ac-titulo"></h3>
            <p id="ac-texto" style="color:var(--a-muted)"></p>
            <div class="modal-acciones">
              <button class="btn btn-borde" id="ac-no">Cancelar</button>
              <button class="btn btn-primario" id="ac-si"></button>
            </div>
          </div>`;
        document.body.appendChild(fondo);
      }
      fondo.querySelector('#ac-titulo').textContent = titulo;
      fondo.querySelector('#ac-texto').textContent = texto;
      fondo.querySelector('#ac-si').textContent = boton;
      fondo.classList.add('abierto');

      const cerrar = (valor) => {
        fondo.classList.remove('abierto');
        fondo.querySelector('#ac-si').onclick = null;
        fondo.querySelector('#ac-no').onclick = null;
        resolver(valor);
      };
      fondo.querySelector('#ac-si').onclick = () => cerrar(true);
      fondo.querySelector('#ac-no').onclick = () => cerrar(false);
    });
  }

  /** Modal genérico con contenido HTML (para previsualizaciones). */
  function modal(html) {
    let fondo = document.getElementById('admin-modal');
    if (!fondo) {
      fondo = document.createElement('div');
      fondo.id = 'admin-modal';
      fondo.className = 'modal-fondo';
      fondo.innerHTML = `<div class="modal-caja" id="admin-modal-caja"></div>`;
      fondo.addEventListener('click', (e) => { if (e.target === fondo) fondo.classList.remove('abierto'); });
      document.body.appendChild(fondo);
    }
    fondo.querySelector('#admin-modal-caja').innerHTML = html;
    fondo.classList.add('abierto');
    return fondo.querySelector('#admin-modal-caja');
  }

  function cerrarModal() {
    const fondo = document.getElementById('admin-modal');
    if (fondo) fondo.classList.remove('abierto');
  }

  /** Botón "Mostrar más" (carga progresiva). */
  function botonMas(contenedor, texto = 'Mostrar más', alPulsar) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-borde';
    btn.textContent = `⬇ ${texto}`;
    btn.style.marginTop = '14px';
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = 'Cargando…';
      try { await alPulsar(btn); }
      catch (e) { toast(e.message, 'error'); btn.textContent = texto; }
      btn.disabled = false;
    });
    contenedor.appendChild(btn);
    return btn;
  }

  /** Etiqueta de estado. */
  function insigniaEstado(estado) {
    return `<span class="insignia-estado ${esc(estado || 'borrador')}">${esc(estado || 'sin estado')}</span>`;
  }

  window.AdminUI = { toast, confirmar, modal, cerrarModal, botonMas, insigniaEstado };
})();
