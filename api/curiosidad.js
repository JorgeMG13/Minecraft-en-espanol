// api/list-curiosidades.js — Página /curiosidades (listado renderizado en servidor).
export const config = { runtime: 'edge' };

import { SITE } from './_lib/config.js';
import { listarPublicos } from './_lib/sb.js';
import { pagina, respuestaHtml, esc } from './_lib/html.js';

export default async function handler() {
  const items = await listarPublicos('curiosidades', { select: 'id,texto,fecha' });

  const tarjetas = items.length === 0
    ? `<div class="empty">💡 Aún no hay datos curiosos publicados.</div>`
    : items.map(c => {
        const preview = (c.texto || '').slice(0, 160) + ((c.texto || '').length > 160 ? '…' : '');
        return `<a class="card" href="${SITE}/curiosidades/${c.id}">
          <span class="card-icon">💡</span>
          <span class="card-text">${esc(preview)}</span>
          <span class="card-date">${esc(c.fecha)}</span>
        </a>`;
      }).join('');

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Datos Curiosos de Minecraft en Español',
    url: `${SITE}/curiosidades`,
    numberOfItems: items.length,
    itemListElement: items.slice(0, 10).map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE}/curiosidades/${c.id}`,
      name: (c.texto || '').slice(0, 80)
    }))
  };

  const html = pagina({
    titulo: 'Datos Curiosos de Minecraft en Español | Secretos y curiosidades del juego',
    descripcion: 'Descubre los datos más curiosos y secretos de Minecraft en español. Curiosidades sobre mecánicas, historia y personajes que quizás no conocías.',
    canonica: `${SITE}/curiosidades`,
    schema,
    etiqueta: '💡 DATOS CURIOSOS',
    css: ['/assets/css/components/cards.css', '/assets/css/pages/curiosidades.css'],
    cuerpo: `
      <h1 class="page-title">Datos <span>Curiosos</span></h1>
      <p class="page-sub">Secretos y curiosidades de Minecraft que quizás no conocías.</p>
      <div class="grid">${tarjetas}</div>`
  });

  return respuestaHtml(html);
}
