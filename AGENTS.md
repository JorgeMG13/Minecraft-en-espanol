## API Structure (Actual — actualizado)

### Edición: Edge Functions (8)
Todos usan ESM (`export default`), `export const config = { runtime: 'edge' }`.

**Biblioteca compartida _lib/ (todos importan):**
- `config.js` — SITE, SB_URL, SB_ANON_KEY, ESTADO_PUBLICADA (ahora compartido, NO por archivo)
- `sb.js` — cliente REST público, listarPublicos(), obtenerArticulo() (slug-primero), obtenerPorId()
- `html.js` — pagina() constructor de shell SEO, respuestaHtml() para CDN, esc() helper
- `slug.js` — slugificar(), slugOcupado(), slugUnico() (genera slugs únicos)

**Cada archivo edge:**
- Pages de listado (`list-noticias.js`, `list-guias.js`, `list-curiosidades.js`, `list-otros.js`)
  - `listarPublicos()` con filtro de estado (`estado=publicada` o `null`)
  - Tarjetas con links `${SITE}/noticias/${slug}`
- Pages de detalle (`noticia.js`, `guia.js`, `curiosidad.js`, `otros.js`)
  - `obtenerArticulo()` desde `?id=` (slug o id antiguo)
  - Shell SEO con scripts externos cargados en cliente
- `sitemap.js` — sitemap dinámico con slugs de noticias/guias/otros

### Node Functions (3)
Todos ahora ESM (`import { createClient } from '@supabase/supabase-js'`, requieren env vars `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`):

- `api/_lib/node.js` — clienteSupabase(), cronAutorizado(), aplicarCors() (domina CORS para el DOMINIO DEL PANEL)
- `api/_lib/admin-auth.js` — HMAC-Sha256 session tokens, comparaSegura(), crearToken(), esAdmin(req) para rutas admin
- `api/_lib/publicar.js` — publicarProgramadas() (usa slugUnico para publicar desde noticias_ia)

**Cada función node:**
- `api/buscar-noticias.js` — cron RSS→Groq→noticias_ia, auth via _lib
- `api/generar-noticia.js` — descarga URL→Groq proposal, auth via _lib
- `api/publicar-programadas.js` — invoca _lib/publicar.js, auth via cronAutorizado() O esAdmin()

### Admin API (5) — panel DENTRO del sitio principal
Todos Node ESM, protegidos por sesión admin (`esAdmin(req)`):

- `api/admin/login.js` — POST password → cookie firmada (HttpOnly), GET check sesión, DELETE logout
- `api/admin/noticias.js` — GET (pagado+search+filter+single), POST crear noticia (slug manual o automático), PUT editar (slug solo si explícito), DELETE
- `api/admin/noticias-ia.js` — GET (pagado+filter), POST acciones: publicar (crea noticia con slug), programar (guarda campos + publicar_en), guardar (sin cambiar estado), descartar
- `api/admin/mensajes.js` — GET (pagado+filtro nuevos/leídos), PATCH toggle leido, DELETE
- `api/admin/stats.js` — counts: noticias por estado, cola IA, mensajes, visitas (RPC)
- `api/admin/tick.js` — gatilla publicarProgramadas (panel) — usa _lib/publicar.js

### Site externo (`Minecraft-en-espanol-admin/`) — independiente, NO tocado
- Proyecto Vercel separado, usa Supabase Auth
- Funciona con `noticias` (publicadas) y `noticias_ia` (cola) del MISMO Supabase (mtkesqoywahieuapftmh.supabase.co)
- Contiene publicar-programadas.js (Node, CommonJS, CommonJS, sin _lib) y UI admin de una página
- CORS permitido: aplicarCors permite su dominio (`https://minecraft-en-espanol-admin.vercel.app`)
- Mantiene todo el pipeline externo (cron, scraping, etc.)
- Los dos administradores coexisten pero son esquemas separados

### Compatibilidad entre ambos
- Las funciones edge usan la MISMA URL (`https://minecraft-en-espanol.vercel.app`) para SITE, OG, canonical
- Las funciones node usan la MISMA conexión Supabase (service_role para escrituras, anon key para lecturas públicas)
- Ambas pueden invocar `api/buscar-noticias`, `api/generar-noticia`, `api/publicar-programadas`
- Las writes del sitio externo (`Minecraft-en-espanol-admin`) aparecen en `noticias_ia`
- La publicación del panel interno (`api/admin/noticias-ia POST publicar`) escribe directamente en `noticias` con slug generado

### Resumen del pipeline de publicación
1. Cron (`api/buscar-noticias`) → RSS→Groq → `noticias_ia` (pendiente)
2. Admin externo (`Minecraft-en-espanol-admin`) revisa, programa o descarta desde `noticias_ia`
3. Admin interno (`api/admin/noticias-ia`) o sitio (`api/noticia?id=...`) pueden publicar propuestas:
   - Publicar → crea `noticias` con slug único, elimina `noticias_ia`
   - Programar → guarda en `noticias_ia` con estado='programada', `publicar_en`
   - `api/admin/tick` / `api/publicar-programadas` (externo) mueven programadas a publicadas

### Scripts locales (Si hay npm)
- `npm run backfill:slugs` — rellena slugs nulos desde titulos
- `npm run verificar` — sintaxis + renderizado real contra Supabase real (usando anon key)
