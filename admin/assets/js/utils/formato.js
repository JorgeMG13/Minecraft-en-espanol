// admin/assets/js/utils/formato.js — utilidades de formato del panel.
window.AdminFormato = {
  /** slug local para previsualizar (la unicidad la garantiza el servidor). */
  slugificar(texto) {
    return String(texto || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ñ/gi, 'n')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80)
      .replace(/-+$/g, '');
  },

  /** Fecha ISO o "13 de julio de 2026" → "2026-07-13" (para input date). */
  fechaAInput(valor) {
    if (!valor) return '';
    if (/^\d{4}-\d{2}-\d{2}/.test(valor)) return valor.slice(0, 10);
    const MESES = { enero:'01', febrero:'02', marzo:'03', abril:'04', mayo:'05', junio:'06',
                    julio:'07', agosto:'08', septiembre:'09', octubre:'10', noviembre:'11', diciembre:'12' };
    const m = String(valor).toLowerCase().match(/(\d{1,2}) de (\w+) de (\d{4})/);
    if (m && MESES[m[2]]) return `${m[3]}-${MESES[m[2]]}-${String(m[1]).padStart(2, '0')}`;
    const d = new Date(valor);
    return isNaN(d) ? '' : d.toISOString().slice(0, 10);
  },

  /** "2026-07-13" → "13 de julio de 2026" (formato que muestra el sitio). */
  inputAFechaEs(valor) {
    if (!valor) return '';
    const d = new Date(`${valor}T12:00:00`);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
  },

  /** Fecha legible corta para listados: 13 jul 2026 · 12:30 */
  fechaCorta(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return String(iso);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) +
           ' · ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  },

  /** Extrae el id de YouTube para la miniatura de previsualización. */
  youtubeId(url) {
    const m = String(url || '').match(/(?:v=|youtu\.be\/|embed\/|shorts\/|live\/)([A-Za-z0-9_-]{6,})/);
    return m ? m[1] : null;
  }
};
