// api/otros.js — Página /otros/:slug (detalle; shell SEO en servidor, cuerpo en cliente).
export const config = { runtime: 'edge' };

import { SITE } from './_lib/config.js';
import { obtenerArticulo } from './_lib/sb.js';
import { pagina, respuestaHtml, esc } from './_lib/html.js';

const SCRIPTS = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  '/assets/js/config.js',
  '/assets/js/utils/dom.js',
  '/assets/js/services/supabase.js',
  '/assets/js/pages/otros.js'
];

export default async function handler(req) {
  const url = new URL(req.url);
  const idOSlug = url.searchParams.get('id');

  let titulo = 'Contenido extra | Minecraft en Español';
  let descripcion = 'Seeds, redstone, builds y contenido extra de Minecraft en español.';
  let canonica = `${SITE}/otros`;

  if (idOSlug) {
    const o = await obtenerArticulo('otros', idOSlug, 'titulo,texto,slug,id');
    if (o) {
      titulo = o.titulo || titulo;
      if (o.texto) descripcion = o.texto.replace(/\n/g, ' ').slice(0, 160);
      canonica = `${SITE}/otros/${o.slug || o.id}`;
    }
  }

  const html = pagina({
    titulo,
    descripcion,
    canonica,
    tipo: 'article',
    etiqueta: '🎭 OTROS',
    volver: { href: '/', texto: '← Volver' },
    css: ['/assets/css/pages/articulo.css'],
    scripts: SCRIPTS,
    cuerpo: `
      <div class="sk sk-img"></div>
      <div class="sk sk-ln" style="width:70%;height:40px;margin-bottom:16px;"></div>
      <div class="sk sk-ln" style="width:30%;margin-bottom:32px;"></div>
      <div class="sk sk-ln" style="width:75%"></div>`
  });

  return respuestaHtml(html, 60, 300);
}
