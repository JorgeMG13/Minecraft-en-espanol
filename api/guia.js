// api/guia.js — Página /guias/:slug (detalle; shell SEO en servidor, cuerpo en cliente).
export const config = { runtime: 'edge' };

import { SITE } from './_lib/config.js';
import { obtenerArticulo } from './_lib/sb.js';
import { pagina, respuestaHtml, esc } from './_lib/html.js';

const SCRIPTS = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  '/assets/js/config.js',
  '/assets/js/utils/dom.js',
  '/assets/js/utils/video.js',
  '/assets/js/services/supabase.js',
  '/assets/js/pages/guia.js'
];

export default async function handler(req) {
  const url = new URL(req.url);
  const idOSlug = url.searchParams.get('id');

  let titulo = 'Guía | Minecraft en Español';
  let descripcion = 'Guías paso a paso sobre Minecraft en castellano.';
  let imagen = `${SITE}/favicon-96x96.png`;
  let canonica = `${SITE}/guias`;

  if (idOSlug) {
    const g = await obtenerArticulo('guias', idOSlug, 'titulo,imagen_url,categoria,slug,id');
    if (g) {
      if (g.titulo) titulo = g.titulo;
      if (g.categoria) descripcion = 'Guía de ' + g.categoria + ' · Minecraft en Español';
      if (g.imagen_url) imagen = g.imagen_url;
      canonica = `${SITE}/guias/${g.slug || g.id}`;
    }
  }

  const html = pagina({
    titulo,
    descripcion,
    imagen,
    canonica,
    tipo: 'article',
    etiqueta: '📖 GUÍA',
    volver: { href: '/', texto: '← Volver' },
    css: ['/assets/css/pages/articulo.css'],
    scripts: SCRIPTS,
    cuerpo: `
      <div class="sk sk-img"></div>
      <div class="sk sk-ln" style="width:25%"></div>
      <div class="sk sk-ln" style="width:70%;height:40px;margin-bottom:32px;"></div>
      <div class="sk sk-ln"></div>
      <div class="sk sk-ln" style="width:85%"></div>
      <div class="sk sk-ln" style="width:90%"></div>`
  });

  return respuestaHtml(html, 60, 300);
}
