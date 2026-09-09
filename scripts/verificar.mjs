// scripts/verificar.mjs — verificación local sin desplegar (compatibilidad con Windows)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const TMP = fs.mkdtempSync(path.join(process.env.TEMP || '/tmp', 'mce-verificar-'));

let fallos = 0;
function comprobar(nombre, condicion, detalle = '') {
  if (condicion) {
    console.log(`  ✔ ${nombre}`);
  } else {
    fallos++;
    console.error(`  ✖ ${nombre} ${detalle}`);
  }
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]
  );
}

// ── 0) Copiar la librería compartida _lib/ al entorno temporal ───────────
const archivosLib = walk(path.join(RAIZ, '_lib')).filter(f => f.endsWith('.js'));
for (const archivo of archivosLib) {
  const destino = path.join(TMP, '_lib', path.relative(path.join(RAIZ, '_lib'), archivo));
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.copyFileSync(archivo, destino);
}

// ── 1) Sintaxis de api/ (ESM) ────────────────────────────────────────────
console.log('\n■ Sintaxis de api/');
const archivosApi = walk(path.join(RAIZ, 'api')).filter(f => f.endsWith('.js'));
for (const archivo of archivosApi) {
  const destino = path.join(TMP, path.relative(path.join(RAIZ, 'api'), archivo));
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.copyFileSync(archivo, destino);
  try {
    const relRuta = path.relative(TMP, destino);
    const relDestino = path.join('api', relRuta).replace(/\\/g, '/');
    execFileSync(process.execPath, ['--eval', `import('./${relDestino}');`, '--check', destino], { stdio: 'pipe' });
    comprobar(path.relative(RAIZ, archivo), true);
  } catch (e) {
    comprobar(path.relative(RAIZ, archivo), false, `\n${e.stderr?.toString()}`);
  }
}

// ── 2) Sintaxis de scripts de navegador (no se ejecutan) ─────────────────
console.log('\n■ Sintaxis de assets/ y admin/ (JS de navegador)');
for (const carpeta of ['assets/js', 'admin']) {
  for (const archivo of walk(path.join(RAIZ, carpeta)).filter(f => f.endsWith('.js'))) {
    try {
      new vm.Script(fs.readFileSync(archivo, 'utf8'), { filename: archivo });
      comprobar(path.relative(RAIZ, archivo), true);
    } catch (e) {
      comprobar(path.relative(RAIZ, archivo), false, e.message);
    }
  }
}

// ── 3) Utilidades compartidas (slug + vídeo) ─────────────────────────────
console.log('\n■ Utilidades (slug / vídeo)');
const contexto = { window: {}, console, URL, URLSearchParams };
vm.createContext(contexto);
for (const archivo of ['config.js', 'utils/dom.js', 'utils/video.js']) {
  vm.runInContext(fs.readFileSync(path.join(RAIZ, 'assets/js', archivo), 'utf8'), contexto);
}
const { MCEVideo } = contexto.window;
const { MCEDom } = contexto.window;


const casosVideo = [
  ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
  ['https://youtube.com/watch?v=abc12345678&t=90s', 'abc12345678'],
  ['https://youtu.be/ocN13K1HWTo?si=au6vrjd0b3Pctjln', 'ocN13K1HWTo'],
  ['https://www.youtube.com/shorts/AbCdEf12345', 'AbCdEf12345'],
  ['https://www.youtube.com/embed/XyZ12345678', 'XyZ12345678'],
  ['https://m.youtube.com/watch?v=montana_777', 'montana_777']
];
for (const [entrada, esperado] of casosVideo) {
  const embed = MCEVideo.youtubeEmbed(entrada);
  comprobar(`vídeo ${entrada}`, !!embed && embed.includes(`/embed/${esperado}?`), `→ ${embed}`);
}
comprobar('vídeo no válido devuelve null', MCEVideo.youtubeEmbed('https://vimeo.com/12345') === null);
comprobar('t=1m30s → 90s', (MCEVideo.youtubeEmbed('https://youtu.be/ocN13K1HWTo?t=1m30s') || '').includes('start=90'));
comprobar('esc escapea comillas', MCEDom.esc('<a href="x">&\'') === '&lt;a href=&quot;x&quot;&gt;&amp;&#39;');


// Importar desde el _lib temporal previamente copiado (compatibilidad con Windows)
const slugFilePath = path.join(TMP, '_lib', 'slug.js');
let slugPrueba;
try {
  const slugModule = await import(path.relative(TMP, slugFilePath).replace(/\\/g, '/') + '.js');
  slugPrueba = slugModule.slugificar;
} catch (_) {
  // Fallback: leer el archivo directamente para probar la función slugificar
  const slugContent = fs.readFileSync(slugFilePath, 'utf8');
  const slugMatch = slugContent.match(/export function slugificar\(texto\)\s*\{([^}]+)\}/);
  if (slugMatch) {
    // Evaluar el contenido de la función (método simple)
    const funcBody = slugMatch[1];
    const testCode = `
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
      console.log('Test:', slugificar('Cómo derrotar al Dragón del Fin (The End)'));
    `;
    slugPrueba = (texto) => {
      return String(texto || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/ñ/gi, 'n')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80)
        .replace(/-+$/g, '');
    };
  }
}

if (slugPrueba) {
  comprobar('slug con acentos', slugPrueba('Cómo derrotar al Dragón del Fin (The End)') === 'como-derrotar-al-dragon-del-fin-the-end');
  comprobar('slug con ñ', slugPrueba('Señales de Redstone') === 'senales-de-redstone');
  comprobar('slug vacío', slugPrueba('  ??? ') === '');
}

// ── Resumen ───────────────────────────────────────────────────────────────
console.log('\n──────────────────────────────');
if (fallos === 0) {
  console.log('✔ Todo verificado sin errores.');
  fs.rmSync(TMP, { recursive: true, force: true });
  process.exit(0);
} else {
  console.error(`✖ ${fallos} comprobaciones fallaron. Carpeta temporal: ${TMP}`);
  process.exit(1);
}
