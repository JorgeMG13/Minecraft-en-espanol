// api/_lib/html.js — construcción del HTML común (head SEO, cabecera, pie).

import { SITE } from './config.js';

/** Escapa texto para HTML (atributos y contenido). */
export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Fuentes e iconos comunes a todas las páginas. */
function headComun(imagen) {
  return `
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta property="og:site_name"   content="Minecraft en Español" />
  <meta property="og:image"       content="${esc(imagen)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:locale"      content="es_ES" />
  <meta name="twitter:card"       content="summary_large_image" />
  <meta name="twitter:image"      content="${esc(imagen)}" />
  <link rel="icon" type="image/png" href="/favicon-96x96.png" sizes="96x96" />
  <link rel="shortcut icon" href="/favicon.ico" />
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
  <link rel="manifest" href="/site.webmanifest" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Rajdhani:wght@400;600;700&family=Barlow+Condensed:ital,wght@0,400;0,600;0,700;1,400&display=swap" rel="stylesheet" />`;
}

/**
 * Página completa. Opciones:
 *   titulo, descripcion, imagen, canonica, tipo ('website'|'article'),
 *   schema (objeto JSON-LD | null), etiqueta (texto cabecera),
 *   volver {href, texto}, wrapId, css (array de rutas), cuerpo (HTML de <main>),
 *   scripts (array de rutas JS al final del body).
 */
export function pagina(opciones) {
  const {
    titulo, descripcion = '', imagen = `${SITE}/titulo-minecraft-espanol.png`,
    canonica, tipo = 'website', schema = null, etiqueta = '',
    volver = { href: '/', texto: '← Inicio' }, wrapId = 'wrap',
    css = [], cuerpo = '', scripts = [],
  } = opciones;

  const cssLinks = css.map(h => `<link rel="stylesheet" href="${h}" />`).join('\n  ');
  const scriptTags = scripts.map(s => `<script src="${s}"></script>`).join('\n  ');
  const schemaTag = schema ? `<script type="application/ld+json">${JSON.stringify(schema)}</script>` : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>${esc(titulo)}</title>
  <meta name="description" content="${esc(descripcion)}" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${esc(canonica)}" />
  <meta property="og:type"        content="${tipo}" />
  <meta property="og:url"         content="${esc(canonica)}" />
  <meta property="og:title"       content="${esc(titulo)}" />
  <meta property="og:description" content="${esc(descripcion)}" />
  ${headComun(imagen)}
  ${schemaTag}
  ${cssLinks}
</head>
<body>
  <div class="pixel-strip"></div>
  <header>
    <a href="${esc(volver.href)}" class="btn-back">${esc(volver.texto)}</a>
    <span class="header-label">${esc(etiqueta)}</span>
  </header>
  <main>
    <div class="wrap" id="${esc(wrapId)}">
${cuerpo}
    </div>
  </main>
  <div class="pixel-strip"></div>
  <footer>© 2026 MINECRAFT EN ESPAÑOL · HECHO CON BLOQUES PARA VOSOTROS</footer>
  ${scriptTags}
</body>
</html>`;
}

/** Respuesta HTML con caché breve en CDN. */
export function respuestaHtml(html, sMaxAge = 120, swr = 600) {
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': `s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`,
    },
  });
}
