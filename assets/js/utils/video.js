// assets/js/utils/video.js — conversión de URLs de YouTube a reproductor embebido.
// Acepta: youtube.com/watch?v=…, youtu.be/…, /embed/, /shorts/, /live/,
// dominios móviles, con o sin parámetros adicionales (t, start, si, list…).
window.MCEVideo = {
  /** ¿La URL apunta a un vídeo de YouTube? */
  esEnlaceVideo(url) {
    return /(?:youtube\.com|youtu\.be|youtube-nocookie\.com)/i.test(String(url || ''));
  },

  /**
   * Convierte cualquier URL de YouTube en URL de embed.
   * Devuelve `null` si no es reconocible como vídeo de YouTube.
   */
  youtubeEmbed(url) {
    const u = String(url || '').trim();
    if (!u) return null;

    let m = u.match(/(?:youtube(?:-nocookie)?\.com)\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/|v\/)([A-Za-z0-9_-]{6,})/i)
         || u.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/i);
    if (!m) return null;

    const params = new URLSearchParams({ rel: '0' });
    const t = u.match(/[?&](?:start|t)=([0-9hms]+)/i);
    if (t) {
      const segundos = this._aSegundos(t[1]);
      if (segundos > 0) params.set('start', String(segundos));
    }
    return `https://www.youtube-nocookie.com/embed/${m[1]}?${params}`;
  },

  /** "90" → 90 · "1m30s" → 90 · "2m" → 120 */
  _aSegundos(valor) {
    const v = String(valor).toLowerCase();
    if (/^\d+$/.test(v)) return parseInt(v, 10);
    let total = 0;
    const horas = v.match(/(\d+)h/), mins = v.match(/(\d+)m/), segs = v.match(/(\d+)s/);
    if (horas) total += parseInt(horas[1], 10) * 3600;
    if (mins) total += parseInt(mins[1], 10) * 60;
    if (segs) total += parseInt(segs[1], 10);
    return total;
  },

  /** HTML del reproductor (iframe) listo para insertar. */
  iframe(url, clase = 'fs-video') {
    const embed = this.youtubeEmbed(url);
    if (!embed) return '';
    return `<iframe class="${clase}" src="${window.MCEDom.esc(embed)}" title="Vídeo de YouTube" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>`;
  }
};
