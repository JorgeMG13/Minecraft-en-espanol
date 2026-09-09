// api/noticia.js — Página /noticias/:slug (detalle; el shell SEO se renderiza
// en servidor y el cuerpo se carga en cliente). El parámetro `id` que entrega
// la reescritura de Vercel puede ser un slug o un id antiguo.
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
  '/assets/js/pages/noticia.js'
];

export default async function handler(req) {
  const url = new URL(req.url);
  const idOSlug = url.searchParams.get('id');

  let titulo = 'Minecraft en Español';
  let descripcion = 'Noticias, guías, datos curiosos y quiz sobre Minecraft en castellano.';
  let imagen = `${SITE}/favicon-96x96.png`;
  let canonica = `${SITE}/noticias`;
  let schema = null;

  if (idOSlug) {
    const n = await obtenerArticulo('noticias', idOSlug, 'titulo,texto,imagen,slug,id,created_at');
    if (n) {
      titulo = n.titulo || titulo;
      if (n.texto) descripcion = n.texto.replace(/\n/g, ' ').slice(0, 160);
      if (n.imagen) imagen = n.imagen;
      canonica = `${SITE}/noticias/${n.slug || n.id}`;
      schema = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: titulo,
        image: n.imagen || imagen,
        mainEntityOfPage: canonica,
        datePublished: n.created_at,
        dateModified: n.created_at,
        inLanguage: 'es',
        publisher: { '@type': 'Organization', name: 'Minecraft en Español', url: SITE }
      };
    }
  }

  const html = pagina({
    titulo: titulo === 'Minecraft en Español' ? titulo : `${titulo} | Minecraft en Español`,
    descripcion,
    imagen,
    canonica,
    tipo: 'article',
    schema,
    etiqueta: '📰 NOTICIA',
    volver: { href: '/', texto: '← Volver' },
    css: ['/assets/css/pages/articulo.css'],
    scripts: SCRIPTS,
    cuerpo: `
      <div class="sk sk-img"></div>
      <div class="sk sk-ln" style="width:25%"></div>
      <div class="sk sk-ln" style="width:70%;height:40px;margin-bottom:16px;"></div>
      <div class="sk sk-ln" style="width:30%;margin-bottom:32px;"></div>
      <div class="sk sk-ln"></div>
      <div class="sk sk-ln" style="width:90%"></div>
      <div class="sk sk-ln" style="width:80%"></div>
      <div class="sk sk-ln" style="width:95%"></div>`
  });

  return respuestaHtml(html, 60, 300);
}
