# Minecraft-en-espanol

## Configuración y Despliegue

### Setup local con Docker (opcional)
- No hay Node.js de por vida, solo Node functions que requieren env vars de Vercel.
- Los archivos están listos para implementarse directamente en Vercel.

## Variables de Entorno (Vercel Dashboard)

### Para las funciones edge (las que renderizan HTML):
- Ninguna — usan una anon key hardcodeada en `api/_lib/config.js` (pública por diseño; RLS protege las escrituras).

### Para las funciones Node (serverless):

#### Admin Panel (dentro del sitio):
- `SUPABASE_URL` — conexión de servicio a Supabase (mtkesqoywahieuapftmh.supabase.co)
- `SUPABASE_SERVICE_KEY` — clave de servicio de Supabase (necesaria para escrituras)
- `CRON_SECRET` — secreto para proteger los endpoints del cron (compartido con el sitio externo)
- `ADMIN_PASSWORD` — contraseña para el panel de admin (`/api/admin/login`)
- `ADMIN_SESSION_SECRET` — opcional; si no está, usa `CRON_SECRET` o `ADMIN_PASSWORD`

#### Cron RSS→Groq (busca-noticias y generar-noticia):
- `GROQ_API_KEY` — clave de API para llama-3.3-70b-versatile (usada solo en buscar-noticias y generar-noticia)

### Para el sitio externo (`Minecraft-en-espanol-admin`):
- `SUPABASE_URL` y `SUPABASE_SERVICE_KEY` (del MISMO proyecto)
- `CRON_SECRET` (compartido con las funciones del sitio principal)

## Arquitectura

### Funciónes Edge (8) — renderizan HTML completo para SEO
`export const config = { runtime: 'edge' }` + ESM `export default`

**Biblioteca compartida:** `api/_lib/` (todas importadas por las edge functions)
- `config.js` — SITE, SB_URL, SB_ANON_KEY, ESTADO_PUBLICADA
- `sb.js` — cliente REST (listarPublicos, obtenerArticulo, etc.)
- `slug.js` — slugificar, slugOcupado, slugUnico
- `html.js` — pagina() (shell SEO), respuestaHtml(), esc()

**Archivos edge:**
- `list-noticias.js`, `list-guias.js`, `list-curiosidades.js`, `list-otros.js` — listados con filtro de estado (`estado=publicada` o `null`)
- `noticia.js`, `guia.js`, `curiosidad.js`, `otros.js` — detalles (shell SEO + cuerpo en cliente)
- `sitemap.js` — sitemap XML dinámico

### Funciones Node (3) — API del sitio y del panel
ESM (`import { createClient } from '@supabase/supabase-js'`), requieren variables del servidor.

**Biblioteca compartida:** `api/_lib/` (todas importadas por las funciones Node)
- `node.js` — clienteSupabase, cronAutorizado, aplicarCors
- `admin-auth.js` — HMAC-Sha256 session tokens, esAdmin, cookie helpers
- `publicar.js` — publicarProgramadas() (slug generation)

**Archivos Node:**
- `buscar-noticias.js` — cron diario (RSS→Groq) → `noticias_ia` con estado='pendiente'
- `generar-noticia.js` — descarga URL → Groq → propuesta (sin publicar)
- `publicar-programadas.js` — cron externo (invocado manualmente) mueve `estado='programada'` a `noticias`

### Admin API (5) — panel DENTRO del sitio principal (`/api/admin/*`)
Todos Node ESM, autenticados con sesión (`esAdmin(req)`):

- `login.js` — POST password → cookie firmada (HttpOnly), GET check sesión, DELETE logout
- `noticias.js` — CRUD para `noticias` (slug automático/manual)
- `noticias-ia.js` — cola de IA (`noticias_ia`): pendiente/programada/publicada, acciones: publicar|programar|guardar|descartar
- `mensajes.js` — bandeja de mensajes de usuarios, toggle leído, eliminar
- `stats.js` — resumen: noticias por estado, cola IA, mensajes, visitas (RPC)
- `tick.js` — gatilla publicarProgramadas desde el panel

### Site externo (`Minecraft-en-espanol-admin/`) — proyecto Vercel INDEPENDIENTE (no tocado)
- UI admin de una página, usa Supabase Auth (separado del admin nuevo)
- Contiene `publicar-programadas.js` (CommonJS, sin _lib) y OCR (quiz) + bulk UI
- CORS permitido: `aplicarCors` permite su dominio (`https://minecraft-en-espanol-admin.vercel.app`)
- Mantiene todo el pipeline externo (cron, scraping, UI de review)
- Esquema separado, pero comparte la MISMA conexión Supabase.

## Compatibilidad entre ambos
- Las edge functions usan la MISMA URL (`https://minecraft-en-espanol.vercel.app`) para SITE, OG, canonical
- Las funciones Node usan la MISMA conexión Supabase (service_role para escrituras, anon key para lecturas públicas)
- Ambas pueden invocar `api/buscar-noticias`, `api/generar-noticia`, `api/publicar-programadas`
- Las writes del sitio externo (`Minecraft-en-espanol-admin`) aparecen en `noticias_ia`
- La publicación del panel interno (`api/admin/noticias-ia POST publicar`) escribe directamente en `noticias` con slug generado

## Pipeline de publicación

1. **Vercel cron (diario 08:00):** `api/buscar-noticias` → RSS→Groq → `noticias_ia` (pendiente)
2. **Admin externo (`Minecraft-en-espanol-admin`):** revisa, programa o descarta desde `noticias_ia`
3. **Admin interno o sitio:** pueden publicar propuestas:
   - Publicar → `noticias` con slug único, elimina `noticias_ia`
   - Programar → guarda en `noticias_ia` con `estado='programada'`, `publicar_en`
   - `api/admin/tick` / `api/publicar-programadas` mueven programadas a publicadas

## Contenido Público (páginas HTML estáticas)

### Páginas principales (`index.html`)
- `/` — portada con hero, buscador, grid de últimas noticias, banners WhatsApp/YouTube, modal de contacto e instalar
- `/noticias` — listado con grid de tarjetas (slug||id)
- `/guias` — listado con grid de tarjetas de guía con badges de dificultad/categoría
- `/curiosidades` — listado con grid de tarjetas con icono de dato curioso
- `/otros` — listado con grid de tarjetas de contenido extra (seed, redstone, etc.)

### Páginas detalle (`noticia.html`, `guia.html`, `curiosidad.html`, `otros.html`)
- Rutas antiguas /detalles con redirección permanente (`vercel.json`) — redirigen a URLs con slug (`/noticias/:slug`)

### Admin (`admin/`)
- `index.html` — panel principal (stats, nueva publicación, gestión por tabs)
- `noticias.html` — editor+lista para `noticias`
- `noticia.html` — editor completo con preview, imagen, video YouTube, modo: noticias|ia, programar con datetime-local
- `ia.html` — cola IA (`noticias_ia`): tabs pendiente/programada/publicada, acciones: publicar|programar|guardar|descartar
- `mensajes.html` — bandeja de mensajes, toggle leído, eliminar

## Recursos Compartidos

### CSS (`assets/css/`)
- `global/global.css` — tema base (variables, reset, cabecera, estructura, artículos, guía pasos)
- `components/cards.css` — tarjetas de noticia/guía/simple reutilizables
- `pages/` — page-specific: `index.css`, `noticias.css`, `curiosidades.css`, `otros.css`, `articulo.css`

### JS (`assets/js/`)
- `config.js` — window.MCE_CONFIG (SITE, SB_URL, SB_ANON_KEY)
- `utils/` — `dom.js` (esc, fechaHoyEs, idDesdeUrl), `video.js` (YouTube embed)
- `services/` — `supabase.js` (capa única: listar, obtener, listarTodo, insertarMensaje, registrarVisita)
- `pages/` — `inicio.js` (home logic), `noticia.js`, `guia.js`, `curiosidad.js`, `otros.js` (cuerpos de detalle en cliente)
- `components/` — `creeper.js` (explosión easter egg)

### Other
- `sw.js` — service worker (solo notificaciones push)
- `site.webmanifest`, favicon assets

## Scripts locales (si hay npm)

- `npm run backfill:slugs` — genera slugs para filas de `noticias` con `slug` nulo (idempotente)
- `npm run verificar` — validación local (sintaxis + renderizado real contra Supabase usando anon key)

## Notas de desarrollo

### Para probar `api/` localmente
1. `npx vercel dev` (con env vars de Vercel pull)
2. El HTML estático abre directamente; las rutas limpias solo resuelven rewrites de Vercel.

### Observaciones sobre rendimiento
- Las edge functions se cachean con `s-maxage` en `respuestaHtml` (120s, SWR 600s) para páginas estáticas.
- El sitemap también está cacheado (3600 / 86400).

### Compatibilidad con las URLs antiguas
- Las redirecciones antiguas (`.html`) preservan las URLs viejas con `id` de query param (por ejemplo, `/noticia.html?id=uuid`) para evitar roturas.
- El detail de noticia/guía/curiosidad/otro usa `obtenerArticulo` por slug PRIMERO, luego por id.

### Seguridad
- Las escrituras solo son posibles a través de las APIs protegidas: admin panel (`api/admin/*`) o el cron externo (`api/buscar-noticias`, `api/generar-noticia`) con `CRON_SECRET`.
- El panel de admin usa cookies HMAC-SHA256 firmadas (HttpOnly, SameSite=Strict).
- Las tablas de Supabase tienen RLS: `mensajes` permite INSERT anónimo (formulario de contacto) y todo el resto requiere sesión admin.

### Pipelines (externo vs interno)
- **Externo (`Minecraft-en-espanol-admin`):** UI de una página, funciones Node CommonJS, sin _lib, `publicar-programadas.js` (sin slug generation). Solo usa `CRON_SECRET` (compartido).
- **Interno (`api/admin/*`):** Node ESM, usa `_lib/admin-auth.js` + `_lib/publicar.js` (slug generation), session auth, tabs por tipo de contenido.

### Actualizaciones
- Agregar una nueva página: sigue los patrones de css/pages/<pagina>.css + assets/js/pages/<pagina>.js + update vercel.json + links.
- Si necesitas un nuevo tipo de contenido (por ejemplo, un catálogo de mods), crea `api/list-mods.js`, `api/mod.js`, actualiza assets/css/pages/mod.css, assets/js/pages/mod.js, links, sitemap.
- Si cambias SITE en `api/_lib/config.js`, edita también el SITE en `assets/js/config.js`.

### Enlaces
- Site principal: `https://minecraft-en-espanol.vercel.app/`
- Admin externo: `https://minecraft-en-espanol-admin.vercel.app/`

## Mantenimiento
- Recuerda correr `npm run backfill:slugs` si necesitas rellenar slugs después de importar datos antiguos.
- Ejecuta `npm run verificar` localmente para sintaxis + verificación de renderizado real contra Supabase (requiere variables de entorno).
