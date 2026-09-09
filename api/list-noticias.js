// api/list-noticias.js — Página /noticias (listado renderizado en servidor).
export const config = { runtime: 'edge' };

import { SITE } from './_lib/config.js';
import { listarPublicos } from './_lib/sb.js';
import { pagina, respuestaHtml, esc } from './_lib/html.js';

export default async function handler() {
  const items = await listarPublicos('noticias', { select: 'id,titulo,texto,imagen,fecha,slug' });

  const tarjetas = items.length === 0
    ? `<div class="empty">📭 Aún no hay noticias publicadas.</div>`
    : items.map(n => {
        const imgHtml = n.imagen
          ? `<div class="post-card-img-wrap"><img class="post-card-img" src="${esc(n.imagen)}" alt="${esc(n.titulo)}" loading="lazy" /></div>`
          : `<div class="post-card-placeholder">📰</div>`;
        const resumen = (n.texto || '').slice(0, 120) + ((n.texto || '').length > 120 ? '…' : '');
        return `<a class="post-card" href="${SITE}/noticias/${encodeURIComponent(n.slug || n.id)}">
          ${imgHtml}
          <div class="post-card-body">
            <span class="post-card-cat">Noticia</span>
            <div class="post-card-title">${esc(n.titulo)}</div>
            <div class="post-card-excerpt">${esc(resumen)}</div>
            <div class="post-card-meta">${esc(n.fecha)}</div>
          </div>
        </a>`;
      }).join('');

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Noticias de Minecraft en Español',
    url: `${SITE}/noticias`,
    numberOfItems: items.length,
    itemListElement: items.slice(0, 10).map((n, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE}/noticias/${n.slug || n.id}`,
      name: n.titulo
    }))
  };

  const html = pagina({
    titulo: 'Noticias de Minecraft en Español | Últimas actualizaciones 2025',
    descripcion: 'Últimas noticias sobre Minecraft en español: actualizaciones, novedades, eventos y todo lo que pasa en el mundo de Minecraft en castellano.',
    canonica: `${SITE}/noticias`,
    schema,
    etiqueta: '📰 NOTICIAS',
    css: ['/assets/css/components/cards.css', '/assets/css/pages/noticias.css'],
    cuerpo: `
      <h1 class="page-title">Últimas <span>Noticias</span></h1>
      <p class="page-sub">Todo lo que pasa en el mundo de Minecraft, en español.</p>
      <div class="news-grid">${tarjetas}</div>`
  });

  return respuestaHtml(html);
}
