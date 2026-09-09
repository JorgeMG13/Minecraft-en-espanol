// admin/assets/js/pages/noticia.js — editor de noticias.
// Modos: 'noticias' (crear/editar en la tabla noticias) y
//        'ia' (revisar una propuesta de la cola noticias_ia antes de publicar).
(function () {
  const { esc } = window.MCEDom;
  const { toast, confirmar, modal } = window.AdminUI;

  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(window.location.search);
  const modo = params.get('origen') === 'ia' ? 'ia' : 'noticias';
  const idActual = params.get('id');

  // ── Cabecera según modo ────────────────────────────────────────
  if (modo === 'ia') {
    $('titulo-editor').textContent = 'Revisar propuesta IA';
    $('sub-editor').textContent = 'Puedes modificar todo antes de publicar. Nada se publica sin tu revisión.';
    $('btn-publicar').style.display = '';
    $('btn-descartar').style.display = '';
    $('campo-estado-wrap').style.display = 'none';
    AdminNav('ia');
  } else {
    if (idActual) { $('titulo-editor').textContent = 'Editar noticia'; $('sub-editor').textContent = 'Los cambios se aplican al guardar.'; }
    AdminNav('noticias');
  }

  // ── Helpers de formulario ──────────────────────────────────────
  function leerCampos() {
    return {
      titulo: $('campo-titulo').value.trim(),
      texto: $('campo-texto').value.trim(),
      imagen: $('campo-imagen').value.trim() || null,
      enlace: $('campo-enlace').value.trim() || null,
      video_url: $('campo-video').value.trim() || null,
      slug: $('campo-slug').value.trim(),
      fuente: $('campo-fuente').value.trim() || null,
      fecha: AdminFormato.inputAFechaEs($('campo-fecha').value)
    };
  }

  function rellenar(d) {
    $('campo-titulo').value = d.titulo || '';
    $('campo-texto').value = d.texto || '';
    $('campo-imagen').value = d.imagen || '';
    $('campo-video').value = d.video_url || '';
    $('campo-enlace').value = d.enlace || '';
    $('campo-slug').value = d.slug || '';
    $('campo-fuente').value = d.fuente || '';
    $('campo-fecha').value = AdminFormato.fechaAInput(d.fecha) || new Date().toISOString().slice(0, 10);
    if ($('campo-estado').querySelector(`option[value="${d.estado || 'borrador'}"]`)) $('campo-estado').value = d.estado || 'borrador';
    refrescarImagen();
    refrescarVideo();
  }

  // ── Vistas previas ─────────────────────────────────────────────
  function refrescarImagen() {
    const img = $('preview-imagen');
    const url = $('campo-imagen').value.trim();
    if (!url) { img.className = 'vista-mini'; img.removeAttribute('src'); return; }
    img.src = url;
    img.className = 'vista-mini visible';
    img.onerror = () => { img.className = 'vista-mini'; };
  }

  let temporizadorVideo;
  function refrescarVideo() {
    clearTimeout(temporizadorVideo);
    temporizadorVideo = setTimeout(() => {
      const url = $('campo-video').value.trim();
      const cont = $('preview-video');
      cont.innerHTML = url ? window.MCEVideo.iframe(url, 'fs-video') : '';
    }, 400);
  }

  $('campo-imagen').addEventListener('change', refrescarImagen);
  $('campo-video').addEventListener('input', refrescarVideo);

  $('btn-slug-auto').addEventListener('click', () => {
    $('campo-slug').value = AdminFormato.slugificar($('campo-titulo').value);
    $('ayuda-slug').textContent = 'Slug generado. Se comprobará que esté libre al guardar.';
  });

  // ── Guardar / publicar / programar ─────────────────────────────
  function manejarErrorSlug(err) {
    if (err.estado === 409) {
      $('ayuda-slug').textContent = `⚠ ${err.message} Sugerencia libre: "${err.sugerencia || AdminFormato.slugificar(err.sugerencia || '')}"`;
      toast(err.message, 'error');
      return true;
    }
    return false;
  }

  async function enviarGuardado(campos, { silencioso = false } = {}) {
    if (modo === 'ia') {
      return AdminAPI.ia.accion(idActual, 'guardar', campos);
    }
    if (idActual) {
      return AdminAPI.noticias.actualizar(idActual, campos);
    }
    return AdminAPI.noticias.crear({ ...campos, estado: $('campo-estado').value });
  }

  $('form-noticia').addEventListener('submit', async (e) => {
    e.preventDefault();
    const campos = leerCampos();
    if (!campos.titulo || !campos.texto) { toast('Título y contenido son obligatorios.', 'error'); return; }

    $('btn-guardar').disabled = true;
    try {
      const resultado = await enviarGuardado(campos);
      if (modo === 'ia') { toast('Cambios guardados en la propuesta'); }
      else if (idActual) { toast('Noticia actualizada'); }
      else { toast('Noticia creada'); window.location.href = `/admin/noticia.html?id=${encodeURIComponent(resultado.id)}`; return; }
    } catch (err) {
      if (!manejarErrorSlug(err)) toast(err.message, 'error');
    } finally {
      $('btn-guardar').disabled = false;
    }
  });

  $('btn-publicar').addEventListener('click', async () => {
    const campos = leerCampos();
    if (!campos.titulo || !campos.texto) { toast('Título y contenido son obligatorios.', 'error'); return; }
    if (!(await confirmar('Publicar propuesta', 'Se publicará en la web con los campos actuales. ¿Continuar?', 'Publicar'))) return;

    $('btn-publicar').disabled = true;
    try {
      await AdminAPI.ia.accion(idActual, 'publicar', campos);
      toast('🚀 Noticia publicada');
      setTimeout(() => { window.location.href = '/admin/ia.html'; }, 900);
    } catch (err) {
      if (!manejarErrorSlug(err)) toast(err.message, 'error');
      $('btn-publicar').disabled = false;
    }
  });

  $('btn-programar').addEventListener('click', () => {
    const wrap = $('campo-programar-wrap');
    if (wrap.style.display === 'none') {
      wrap.style.display = '';
      $('campo-programar').focus();
      return;
    }
    programar();
  });

  async function programar() {
    const valor = $('campo-programar').value;
    if (!valor) { toast('Elige fecha y hora de publicación.', 'aviso'); return; }
    const campos = leerCampos();
    if (!campos.titulo || !campos.texto) { toast('Título y contenido son obligatorios.', 'error'); return; }

    const cuando = new Date(valor);
    if (isNaN(cuando.getTime())) { toast('Fecha inválida.', 'error'); return; }
    if (!(await confirmar('Programar publicación',
      `La noticia se publicará sola el ${cuando.toLocaleString('es-ES')}.` +
      (modo === 'noticias' && idActual ? ' El borrador actual se moverá a la cola de programadas.' : ''),
      'Programar'))) return;

    try {
      if (modo === 'ia') {
        // Actualiza la propuesta existente y la marca como programada
        await AdminAPI.ia.accion(idActual, 'programar', campos, cuando.toISOString());
      } else {
        // La fuente única de lo programado es la cola `noticias_ia`;
        // si había borrador en `noticias` se traslada para no duplicar.
        if (idActual) await AdminAPI.noticias.eliminar(idActual);
        await AdminAPI.ia.accion(null, 'programar', campos, cuando.toISOString());
      }
      toast('📅 Publicación programada');
      setTimeout(() => { window.location.href = '/admin/ia.html'; }, 900);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  $('btn-descartar').addEventListener('click', async () => {
    if (!(await confirmar('Descartar propuesta', 'Se eliminará de la cola de IA. Esta acción no se puede deshacer.', 'Descartar'))) return;
    try {
      await AdminAPI.ia.accion(idActual, 'descartar');
      toast('Propuesta descartada');
      setTimeout(() => { window.location.href = '/admin/ia.html'; }, 700);
    } catch (err) { toast(err.message, 'error'); }
  });

  // ── Vista previa con el diseño público ─────────────────────────
  $('btn-preview').addEventListener('click', () => {
    const c = leerCampos();
    const hoy = c.fecha || new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
    const caja = modal(`
      <h3>Vista previa</h3>
      <div class="previsualizacion">
        ${c.imagen ? `<img class="hero-img" src="${esc(c.imagen)}" alt="" onerror="this.style.display='none'" />` : ''}
        ${c.video_url && window.MCEVideo.youtubeEmbed(c.video_url) ? window.MCEVideo.iframe(c.video_url) : ''}
        <div class="art-meta">📰 NOTICIA</div>
        <h1 class="art-title">${esc(c.titulo || 'Sin título')}</h1>
        <div class="art-date">${esc(hoy)}</div>
        <div class="art-body">${esc(c.texto || '')}</div>
        ${c.enlace ? `<a class="art-link" href="${esc(c.enlace)}" target="_blank" rel="noopener">🔗 Más información</a>` : ''}
      </div>
      <div class="modal-acciones"><button class="btn btn-borde" onclick="document.getElementById('admin-modal').classList.remove('abierto')">Cerrar</button></div>`);
    caja.scrollTop = 0;
  });

  // ── Carga inicial ──────────────────────────────────────────────
  (async function iniciar() {
    try { await AdminAPI.sesion(); } catch (_) {
      window.location.href = '/admin/index.html';
      return;
    }
    if (!idActual) {
      $('campo-fecha').value = new Date().toISOString().slice(0, 10);
      return;
    }
    try {
      const d = modo === 'ia' ? await AdminAPI.ia.obtener(idActual) : await AdminAPI.noticias.obtener(idActual);
      rellenar(d || {});
      $('ayuda-slug').textContent = modo === 'ia'
        ? 'Se generará automáticamente al publicar si lo dejas vacío.'
        : 'Déjalo vacío para generarlo desde el título. Cámbialo solo si necesitas una URL concreta; el servidor comprueba que no esté repetido.';
    } catch (err) {
      toast(err.message, 'error');
    }
  })();
})();
