// api/sitemap.js — sitemap.xml dinámico: páginas fijas + artículos con slug.
// Se sirve en /sitemap.xml mediante la reescritura de vercel.json.
export const config = { runtime: 'edge' };

import { SITE } from './_lib/config.js';
import { sbGet } from './_lib/sb.js';

function entrada(loc, lastmod) {
  const fecha = lastmod ? `<lastmod>${lastmod}</lastmod>` : '';
  return `  <url><loc>${loc}</loc>${fecha}</url>`;
}

export default async function handler() {
  const [noticias, guias, otros] = await Promise.all([
    sbGet('noticias?select=slug,id,created_at&order=created_at.desc&limit=1000&or=(estado.eq.publicada,estado.is.null)'),
    sbGet('guias?select=slug,id,created_at&order=created_at.desc&limit=500'),
    sbGet('otros?select=slug,id,created_at&order=created_at.desc&limit=500')
  ]);
  const seguras = Array.isArray(noticias) ? noticias : [];

  const paginas = [
    entrada(`${SITE}/`, '2026-05-01'),
    entrada(`${SITE}/noticias`, '2026-05-01'),
    entrada(`${SITE}/guias`, '2026-05-01'),
    entrada(`${SITE}/curiosidades`, '2026-05-01'),
    entrada(`${SITE}/otros`, '2026-05-01')
  ];

  const de = (filas, ruta) =>
    (Array.isArray(filas) ? filas : []).map(a => entrada(`${SITE}/${ruta}/${a.slug || a.id}`, a.created_at ? a.created_at.slice(0, 10) : null));

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...paginas, ...de(seguras, 'noticias'), ...de(guias, 'guias'), ...de(otros, 'otros')].join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400'
    }
  });
}
