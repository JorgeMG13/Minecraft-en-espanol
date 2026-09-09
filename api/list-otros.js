// api/list-otros.js — Página /otros (listado renderizado en servidor).
export const config = { runtime: 'edge' };

import { SITE } from './_lib/config.js';
import { listarPublicos } from './_lib/sb.js';
import { pagina, respuestaHtml, esc } from './_lib/html.js';

export default async function handler() {
  const items = await listarPublicos('otros', { select: 'id,titulo,texto,fecha,slug' });

  const tarjetas = items.length === 0
    ? `<div class="empty">🎭 Aún no hay contenido extra publicado.</div>`
    : items.map(o => {
        const excerpt = (o.texto || '').slice(0, 120) + ((o.texto || '').length > 120 ? '…' : '');
        return `<a class="card" href="${SITE}/otros/${encodeURIComponent(o.slug || o.id)}">
          ${o.titulo ? `<div class="card-title">${esc(o.titulo)}</div>` : ''}
          <div class="card-text">${esc(excerpt)}</div>
          <span class="card-date">${esc(o.fecha)}</span>
        </a>`;
      }).join('');

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Contenido Extra de Minecraft en Español',
    url: `${SITE}/otros`,
    numberOfItems: items.length,
    itemListElement: items.slice(0, 10).map((o, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE}/otros/${o.slug || o.id}`,
      name: o.titulo || (o.texto || '').slice(0, 60)
    }))
  };

  const html = pagina({
    titulo: 'Contenido Extra de Minecraft en Español | Seeds, Redstone y más',
    descripcion: 'Contenido extra sobre Minecraft en español: seeds, redstone, builds destacadas, comunidad y todo lo que no encaja en una sola categoría.',
    canonica: `${SITE}/otros`,
    schema,
    etiqueta: '🎭 CONTENIDO EXTRA',
    css: ['/assets/css/components/cards.css', '/assets/css/pages/otros.css'],
    cuerpo: `
      <h1 class="page-title">Contenido <span>Extra</span></h1>
      <p class="page-sub">Seeds, redstone, builds y todo lo que no cabe en una sola categoría.</p>
      <div class="grid">${tarjetas}</div>`
  });

  return respuestaHtml(html);
}
