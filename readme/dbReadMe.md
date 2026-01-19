
DB: Supabase / Postgres, schema public, 6 tablas

torneos: torneo principal (id, nombre, iniciado, created_at)

grupos: grupos de un torneo (torneo_id FK)

parejas: parejas de un torneo (torneo_id FK, orden, copa_asignada_id FK nullable para pre-asignación flexible)

copas: copas de un torneo (torneo_id FK, orden)

partidos: partidos (pueden ser de grupo o copa)

siempre torneo_id

grupo_id nullable (si es partido de grupo)

copa_id, ronda_copa, orden_copa para copa

pareja_a_id, pareja_b_id (FKs a parejas)

games_a, games_b, updated_at

posiciones_manual: override manual de orden por grupo

torneo_id, grupo_id, pareja_id, orden_manual

RLS

RLS ON: torneos, grupos, parejas, copas, partidos

RLS OFF: posiciones_manual

Policies

En grupos/parejas/partidos/torneos: “public access …” = FOR ALL TO public USING true WITH CHECK true (acceso total).

En copas: policies múltiples, algunas redundantes:

SELECT: público (true) y también anon/auth (true) y otra anon/auth filtrando por torneo_id = ad58...

INSERT: anon/auth (true) y otra anon/auth filtrando por torneo_id = ad58...

UPDATE/DELETE: público (true)

Torneo fijo en policies

Hay un torneo hardcodeado en policies de copas:

ad58a855-fa74-4c2e-825e-32c20f972136

Archivos a generar/usar

schema.sql (DDL ordenado y ejecutable)

rls_policies.sql (RLS + policies)