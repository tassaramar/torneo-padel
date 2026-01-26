


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."copas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "torneo_id" "uuid" NOT NULL,
    "nombre" "text",
    "orden" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."copas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."grupos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "torneo_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL
);


ALTER TABLE "public"."grupos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."parejas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "torneo_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "orden" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "copa_asignada_id" "uuid"
);


ALTER TABLE "public"."parejas" OWNER TO "postgres";


COMMENT ON COLUMN "public"."parejas"."copa_asignada_id" IS 'Copa a la que está pre-asignada esta pareja (antes de generar cruces). NULL = no asignada';



CREATE TABLE IF NOT EXISTS "public"."partidos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "torneo_id" "uuid" NOT NULL,
    "grupo_id" "uuid",
    "pareja_a_id" "uuid" NOT NULL,
    "pareja_b_id" "uuid" NOT NULL,
    "games_a" integer,
    "games_b" integer,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "copa_id" "uuid",
    "ronda_copa" "text",
    "orden_copa" integer,
    "estado" "text" DEFAULT 'pendiente'::"text",
    "cargado_por_pareja_id" "uuid",
    "resultado_temp_a" integer,
    "resultado_temp_b" integer,
    "notas_revision" "text",
    "ronda" integer,
    CONSTRAINT "check_estado_valido" CHECK (("estado" = ANY (ARRAY['pendiente'::"text", 'a_confirmar'::"text", 'confirmado'::"text", 'en_revision'::"text"]))),
    CONSTRAINT "partidos_grupo_xor_copa_chk" CHECK (((("copa_id" IS NULL) AND ("grupo_id" IS NOT NULL)) OR (("copa_id" IS NOT NULL) AND ("grupo_id" IS NULL))))
);


ALTER TABLE "public"."partidos" OWNER TO "postgres";


COMMENT ON COLUMN "public"."partidos"."estado" IS 'Estado del resultado: pendiente (sin cargar), a_confirmar (cargado por una pareja), confirmado (ambas parejas coinciden), en_revision (hay conflicto)';



COMMENT ON COLUMN "public"."partidos"."cargado_por_pareja_id" IS 'ID de la pareja que cargó primero el resultado (para sistema de confirmación doble)';



COMMENT ON COLUMN "public"."partidos"."resultado_temp_a" IS 'Resultado temporal para pareja A cuando hay conflicto (segunda carga diferente)';



COMMENT ON COLUMN "public"."partidos"."resultado_temp_b" IS 'Resultado temporal para pareja B cuando hay conflicto (segunda carga diferente)';



COMMENT ON COLUMN "public"."partidos"."notas_revision" IS 'Notas opcionales cuando hay conflicto (para comunicación entre parejas o con admin)';



COMMENT ON COLUMN "public"."partidos"."ronda" IS 'Número de ronda calculado con Circle Method (Berger Tables). NULL para partidos de copas que usan ronda_copa.';



CREATE TABLE IF NOT EXISTS "public"."posiciones_manual" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "torneo_id" "uuid" NOT NULL,
    "grupo_id" "uuid" NOT NULL,
    "pareja_id" "uuid" NOT NULL,
    "orden_manual" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."posiciones_manual" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."torneos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "iniciado" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."torneos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tracking_eventos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "torneo_id" "uuid" NOT NULL,
    "pareja_id" "uuid" NOT NULL,
    "jugador_nombre" "text" NOT NULL,
    "tipo_evento" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tracking_eventos_tipo_evento_check" CHECK (("tipo_evento" = ANY (ARRAY['visita'::"text", 'carga_resultado'::"text"])))
);


ALTER TABLE "public"."tracking_eventos" OWNER TO "postgres";


COMMENT ON TABLE "public"."tracking_eventos" IS 'Registro de actividad de uso por jugador individual';



COMMENT ON COLUMN "public"."tracking_eventos"."tipo_evento" IS 'Tipo de evento: visita o carga_resultado';



COMMENT ON COLUMN "public"."tracking_eventos"."metadata" IS 'Datos adicionales del evento en formato JSON';



ALTER TABLE ONLY "public"."copas"
    ADD CONSTRAINT "copas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."grupos"
    ADD CONSTRAINT "grupos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."parejas"
    ADD CONSTRAINT "parejas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."partidos"
    ADD CONSTRAINT "partidos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."posiciones_manual"
    ADD CONSTRAINT "posiciones_manual_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."posiciones_manual"
    ADD CONSTRAINT "posiciones_manual_torneo_id_grupo_id_pareja_id_key" UNIQUE ("torneo_id", "grupo_id", "pareja_id");



ALTER TABLE ONLY "public"."torneos"
    ADD CONSTRAINT "torneos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tracking_eventos"
    ADD CONSTRAINT "tracking_eventos_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_grupos_torneo" ON "public"."grupos" USING "btree" ("torneo_id");



CREATE INDEX "idx_parejas_copa_asignada" ON "public"."parejas" USING "btree" ("copa_asignada_id");



CREATE INDEX "idx_parejas_torneo" ON "public"."parejas" USING "btree" ("torneo_id");



CREATE INDEX "idx_partidos_cargado_por" ON "public"."partidos" USING "btree" ("cargado_por_pareja_id");



CREATE INDEX "idx_partidos_copa" ON "public"."partidos" USING "btree" ("copa_id");



CREATE INDEX "idx_partidos_copa_orden" ON "public"."partidos" USING "btree" ("copa_id", "orden_copa");



CREATE INDEX "idx_partidos_estado" ON "public"."partidos" USING "btree" ("estado");



CREATE INDEX "idx_partidos_grupo" ON "public"."partidos" USING "btree" ("grupo_id");



CREATE INDEX "idx_partidos_ronda" ON "public"."partidos" USING "btree" ("ronda");



CREATE INDEX "idx_partidos_torneo" ON "public"."partidos" USING "btree" ("torneo_id");



CREATE INDEX "idx_tracking_eventos_jugador" ON "public"."tracking_eventos" USING "btree" ("jugador_nombre");



CREATE INDEX "idx_tracking_eventos_pareja_tipo" ON "public"."tracking_eventos" USING "btree" ("pareja_id", "tipo_evento");



CREATE INDEX "idx_tracking_eventos_torneo_fecha" ON "public"."tracking_eventos" USING "btree" ("torneo_id", "created_at" DESC);



CREATE OR REPLACE TRIGGER "trg_posiciones_manual_updated_at" BEFORE UPDATE ON "public"."posiciones_manual" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."copas"
    ADD CONSTRAINT "copas_torneo_id_fkey" FOREIGN KEY ("torneo_id") REFERENCES "public"."torneos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."grupos"
    ADD CONSTRAINT "grupos_torneo_id_fkey" FOREIGN KEY ("torneo_id") REFERENCES "public"."torneos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."parejas"
    ADD CONSTRAINT "parejas_copa_asignada_id_fkey" FOREIGN KEY ("copa_asignada_id") REFERENCES "public"."copas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."parejas"
    ADD CONSTRAINT "parejas_torneo_id_fkey" FOREIGN KEY ("torneo_id") REFERENCES "public"."torneos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."partidos"
    ADD CONSTRAINT "partidos_cargado_por_pareja_id_fkey" FOREIGN KEY ("cargado_por_pareja_id") REFERENCES "public"."parejas"("id");



ALTER TABLE ONLY "public"."partidos"
    ADD CONSTRAINT "partidos_copa_id_fkey" FOREIGN KEY ("copa_id") REFERENCES "public"."copas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."partidos"
    ADD CONSTRAINT "partidos_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "public"."grupos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."partidos"
    ADD CONSTRAINT "partidos_pareja_a_id_fkey" FOREIGN KEY ("pareja_a_id") REFERENCES "public"."parejas"("id");



ALTER TABLE ONLY "public"."partidos"
    ADD CONSTRAINT "partidos_pareja_b_id_fkey" FOREIGN KEY ("pareja_b_id") REFERENCES "public"."parejas"("id");



ALTER TABLE ONLY "public"."partidos"
    ADD CONSTRAINT "partidos_torneo_id_fkey" FOREIGN KEY ("torneo_id") REFERENCES "public"."torneos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."posiciones_manual"
    ADD CONSTRAINT "posiciones_manual_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "public"."grupos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."posiciones_manual"
    ADD CONSTRAINT "posiciones_manual_pareja_id_fkey" FOREIGN KEY ("pareja_id") REFERENCES "public"."parejas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."posiciones_manual"
    ADD CONSTRAINT "posiciones_manual_torneo_id_fkey" FOREIGN KEY ("torneo_id") REFERENCES "public"."torneos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tracking_eventos"
    ADD CONSTRAINT "tracking_eventos_pareja_id_fkey" FOREIGN KEY ("pareja_id") REFERENCES "public"."parejas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tracking_eventos"
    ADD CONSTRAINT "tracking_eventos_torneo_id_fkey" FOREIGN KEY ("torneo_id") REFERENCES "public"."torneos"("id") ON DELETE CASCADE;



ALTER TABLE "public"."copas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "copas_delete_public" ON "public"."copas" FOR DELETE USING (true);



CREATE POLICY "copas_insert" ON "public"."copas" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "copas_insert_anon" ON "public"."copas" FOR INSERT TO "authenticated", "anon" WITH CHECK (("torneo_id" = 'ad58a855-fa74-4c2e-825e-32c20f972136'::"uuid"));



CREATE POLICY "copas_read_only" ON "public"."copas" FOR SELECT USING (true);



CREATE POLICY "copas_select" ON "public"."copas" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "copas_select_anon" ON "public"."copas" FOR SELECT TO "authenticated", "anon" USING (("torneo_id" = 'ad58a855-fa74-4c2e-825e-32c20f972136'::"uuid"));



CREATE POLICY "copas_update_public" ON "public"."copas" FOR UPDATE USING (true) WITH CHECK (true);



ALTER TABLE "public"."grupos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."parejas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."partidos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "public access grupos" ON "public"."grupos" USING (true);



CREATE POLICY "public access parejas" ON "public"."parejas" USING (true);



CREATE POLICY "public access partidos" ON "public"."partidos" USING (true);



CREATE POLICY "public access torneos" ON "public"."torneos" USING (true);



CREATE POLICY "public_access_tracking" ON "public"."tracking_eventos" USING (true) WITH CHECK (true);



ALTER TABLE "public"."torneos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tracking_eventos" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";


















GRANT ALL ON TABLE "public"."copas" TO "anon";
GRANT ALL ON TABLE "public"."copas" TO "authenticated";
GRANT ALL ON TABLE "public"."copas" TO "service_role";



GRANT ALL ON TABLE "public"."grupos" TO "anon";
GRANT ALL ON TABLE "public"."grupos" TO "authenticated";
GRANT ALL ON TABLE "public"."grupos" TO "service_role";



GRANT ALL ON TABLE "public"."parejas" TO "anon";
GRANT ALL ON TABLE "public"."parejas" TO "authenticated";
GRANT ALL ON TABLE "public"."parejas" TO "service_role";



GRANT ALL ON TABLE "public"."partidos" TO "anon";
GRANT ALL ON TABLE "public"."partidos" TO "authenticated";
GRANT ALL ON TABLE "public"."partidos" TO "service_role";



GRANT ALL ON TABLE "public"."posiciones_manual" TO "anon";
GRANT ALL ON TABLE "public"."posiciones_manual" TO "authenticated";
GRANT ALL ON TABLE "public"."posiciones_manual" TO "service_role";



GRANT ALL ON TABLE "public"."torneos" TO "anon";
GRANT ALL ON TABLE "public"."torneos" TO "authenticated";
GRANT ALL ON TABLE "public"."torneos" TO "service_role";



GRANT ALL ON TABLE "public"."tracking_eventos" TO "anon";
GRANT ALL ON TABLE "public"."tracking_eventos" TO "authenticated";
GRANT ALL ON TABLE "public"."tracking_eventos" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































