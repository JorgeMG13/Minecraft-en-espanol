// assets/js/utils/dom.js — utilidades compartidas de manipulación y formato.
window.MCEDom = {
  /** Escapa texto para insertarlo de forma segura en HTML. */
  esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  },

  /** Fecha de hoy formateada en es-ES (igual que usa el cron). */
  fechaHoyEs() {
    return new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
  },

  /** Lee el identificador de la URL: ?id= explícito o último segmento del path. */
  idDesdeUrl() {
    const qsId = new URLSearchParams(window.location.search).get('id');
    if (qsId) return qsId;
    const pathId = window.location.pathname.split('/').filter(Boolean).pop();
    const secciones = ['noticia', 'noticias', 'guia', 'guias', 'curiosidad', 'curiosidades', 'otros', 'index.html', ''];
    return pathId && !secciones.includes(pathId) ? pathId : null;
  }
};
