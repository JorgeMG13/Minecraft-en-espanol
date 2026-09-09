// scripts/backfill-slugs.mjs — genera slugs para filas de `noticias` que no
// tengan uno. Idempotente: si todo tiene slug, no hace nada.
//
// Uso (requiere la service key, nunca en el cliente):
//   SUPABASE_URL=https://… SUPABASE_SERVICE_KEY=… npm run backfill:slugs
//   (o `vercel env pull` y luego `node --env-file=.env.local scripts/backfill-slugs.mjs`)

import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Faltan las variables de entorno SUPABASE_URL y SUPABASE_SERVICE_KEY.');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function slugificar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ñ/gi, 'n')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

async function slugUnico(base) {
  let candidato = base;
  let n = 2;
  while (true) {
    const { data } = await sb.from('noticias').select('id').eq('slug', candidato).limit(1);
    if (!data || data.length === 0) return candidato;
    candidato = `${base}-${n++}`;
  }
}

const { data: filas, error } = await sb.from('noticias').select('id,titulo,slug').is('slug', null);
if (error) {
  console.error('Error consultando noticias:', error.message);
  process.exit(1);
}
if (!filas || filas.length === 0) {
  console.log('✔ Todas las noticias ya tienen slug. Nada que hacer.');
  process.exit(0);
}

let corregidas = 0;
for (const fila of filas) {
  const base = slugificar(fila.titulo) || 'noticia';
  const slug = await slugUnico(base);
  const { error: errUpdate } = await sb.from('noticias').update({ slug }).eq('id', fila.id);
  if (errUpdate) {
    console.error(`✖ ${fila.id}: ${errUpdate.message}`);
  } else {
    corregidas++;
    console.log(`✔ "${fila.titulo}" → /noticias/${slug}`);
  }
}
console.log(`\nListo: ${corregidas} de ${filas.length} noticias actualizadas.`);
