-- ═══════════════════════════════════════════════════════════════
-- Migración 0001 · Mejoras de estructura (idempotente, no destructiva)
-- Ejecutar en el SQL Editor de Supabase. Puede ejecutarse varias veces.
--
-- Verificado contra el esquema real en producción:
--   noticias:  id, titulo, texto, imagen, fecha, created_at, enlace,
--              estado, publicar_en, fuente, slug, video_url   (ya existen)
--   guias:     ..., imagen_url, video_url, pasos, categoria, dificultad, slug
--   otros:     ..., imagen, texto, slug
--   curiosidades: id, texto, fecha, created_at
--   mensajes:  id, nombre, email, mensaje, leido, created_at
--   visitas:   id, conut  (+ RPC registrar_visita)
-- No se crea ni elimina ninguna columna: solo índices, defaults y políticas.
-- ═══════════════════════════════════════════════════════════════

-- 1) Integridad de slugs: unicidad (insensible a mayúsculas) en las tablas
--    que ya disponen de slug. Sin efecto sobre datos existentes (verificado:
--    no hay duplicados ni valores nulos en noticias/guias/otros).
CREATE UNIQUE INDEX IF NOT EXISTS noticias_slug_unico
  ON public.noticias (lower(slug)) WHERE slug IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS guias_slug_unico
  ON public.guias (lower(slug)) WHERE slug IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS otros_slug_unico
  ON public.otros (lower(slug)) WHERE slug IS NOT NULL;

-- 2) Índices de ordenado/paginación para las listas y el panel.
CREATE INDEX IF NOT EXISTS noticias_created_at_idx ON public.noticias (created_at DESC);
CREATE INDEX IF NOT EXISTS mensajes_created_at_idx ON public.mensajes (created_at DESC);
CREATE INDEX IF NOT EXISTS mensajes_no_leidos_idx  ON public.mensajes (leido) WHERE leido = false;

-- 3) Estado por defecto en noticias: lo que publica `publicar-programadas`
--    se inserta sin estado; con este default pasa a ser visible al instante.
--    Los flujos que insertan estado explícito (pendiente/borrador) no cambian.
ALTER TABLE public.noticias ALTER COLUMN estado SET DEFAULT 'publicada';

-- 4) RLS de mensajes: garantizar que el formulario público (anon) puede
--    insertar, pero nadie anónimo puede leer, actualizar ni borrar.
--    (El panel de administración lee con service_role, que ignora RLS.)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'public' AND tablename = 'mensajes'
                   AND policyname = 'mensajes_insert_anon') THEN
    CREATE POLICY mensajes_insert_anon ON public.mensajes
      FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'public' AND tablename = 'mensajes'
                   AND policyname = 'mensajes_select_solo_autenticado') THEN
    CREATE POLICY mensajes_select_solo_autenticado ON public.mensajes
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
