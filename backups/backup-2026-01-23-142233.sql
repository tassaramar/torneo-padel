


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
































-- ============================================
-- DATA
-- ============================================

SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- \restrict kx7UCU79QoX7oKe5iePOMgyhrMNlvNFihs0PL9IkhiwLrIUYUbiyy8oWtEdeBTo

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: audit_log_entries; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: flow_state; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: instances; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_clients; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sessions; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_factors; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_authorizations; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_client_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_consents; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: one_time_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sso_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_relay_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sso_domains; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: torneos; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."torneos" ("id", "nombre", "iniciado", "created_at") VALUES
	('ad58a855-fa74-4c2e-825e-32c20f972136', 'Torneo Miércoles', false, '2026-01-10 05:00:37.891404+00');


--
-- Data for Name: copas; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."copas" ("id", "torneo_id", "nombre", "orden", "created_at") VALUES
	('77036bed-04e4-427c-8636-ae79dd0a472e', 'ad58a855-fa74-4c2e-825e-32c20f972136', 'Enamoramiento', 1, '2026-01-21 16:04:43.96589+00'),
	('139c50fd-0465-4496-872b-bc2ef4c6a5b3', 'ad58a855-fa74-4c2e-825e-32c20f972136', 'Novios', 2, '2026-01-21 16:04:43.96589+00'),
	('4f99cc19-64df-4ad4-85e1-a3b83b375f59', 'ad58a855-fa74-4c2e-825e-32c20f972136', 'Comprometidos', 3, '2026-01-21 16:04:43.96589+00'),
	('ac1c2acd-9429-46cc-a0b1-0145a8fefdfb', 'ad58a855-fa74-4c2e-825e-32c20f972136', 'Casados', 4, '2026-01-21 16:04:43.96589+00'),
	('dbc0354a-e3a2-4459-afea-27af7054c927', 'ad58a855-fa74-4c2e-825e-32c20f972136', '¿El auto tiene ISOFIX?', 5, '2026-01-21 16:04:43.96589+00');


--
-- Data for Name: grupos; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."grupos" ("id", "torneo_id", "nombre") VALUES
	('53bc7af8-d65e-47eb-97a4-e0fcf9e65c42', 'ad58a855-fa74-4c2e-825e-32c20f972136', 'Expectativa'),
	('0d18b572-140d-4157-b0cc-df929420cdb6', 'ad58a855-fa74-4c2e-825e-32c20f972136', 'Realidad');


--
-- Data for Name: parejas; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."parejas" ("id", "torneo_id", "nombre", "orden", "created_at", "copa_asignada_id") VALUES
	('4af2cef0-89ce-474f-85c0-a73c6691d1aa', 'ad58a855-fa74-4c2e-825e-32c20f972136', 'Diego - Jesi', 1, '2026-01-20 20:27:33.516296+00', NULL),
	('f1373f49-9128-43e1-bebd-d8b722fc21a6', 'ad58a855-fa74-4c2e-825e-32c20f972136', 'Tincho - Lau', 3, '2026-01-20 20:27:33.516296+00', NULL),
	('7a1272ce-3421-433a-b4ce-8300daf6e28d', 'ad58a855-fa74-4c2e-825e-32c20f972136', 'Seba T - Dani', 4, '2026-01-20 20:27:33.516296+00', NULL),
	('198a5674-f50b-459d-9971-cffcb4bc09b5', 'ad58a855-fa74-4c2e-825e-32c20f972136', 'Max - Iani', 5, '2026-01-20 20:27:33.516296+00', NULL),
	('fec26ac2-902f-44d9-80fb-efad078589f4', 'ad58a855-fa74-4c2e-825e-32c20f972136', 'Ari - Jenny', 6, '2026-01-20 20:27:33.516296+00', NULL),
	('9063b50d-8209-44fc-a020-bee3526f9b1d', 'ad58a855-fa74-4c2e-825e-32c20f972136', 'Ger - Pau', 7, '2026-01-20 20:27:33.516296+00', NULL),
	('43e9c439-2bec-4cb7-b1bc-9671574beb68', 'ad58a855-fa74-4c2e-825e-32c20f972136', 'Lean - Mica', 8, '2026-01-20 20:27:33.516296+00', NULL),
	('720b5f4c-b516-475b-8f14-cf5d05dbee6f', 'ad58a855-fa74-4c2e-825e-32c20f972136', 'Pablo - Nati', 9, '2026-01-20 20:27:33.516296+00', NULL),
	('2266a177-3c20-48f6-968c-133f7463f428', 'ad58a855-fa74-4c2e-825e-32c20f972136', 'Nico - Ani', 10, '2026-01-20 20:27:33.516296+00', NULL),
	('22171e29-a328-43c8-9d9d-773949767fa1', 'ad58a855-fa74-4c2e-825e-32c20f972136', 'Alan - Tammy', 2, '2026-01-20 20:27:33.516296+00', NULL);


--
-- Data for Name: partidos; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."partidos" ("id", "torneo_id", "grupo_id", "pareja_a_id", "pareja_b_id", "games_a", "games_b", "updated_at", "copa_id", "ronda_copa", "orden_copa", "estado", "cargado_por_pareja_id", "resultado_temp_a", "resultado_temp_b", "notas_revision", "ronda") VALUES
	('6b6a3f20-4ff8-452f-96f2-9e77d2a7fe16', 'ad58a855-fa74-4c2e-825e-32c20f972136', '53bc7af8-d65e-47eb-97a4-e0fcf9e65c42', '4af2cef0-89ce-474f-85c0-a73c6691d1aa', '22171e29-a328-43c8-9d9d-773949767fa1', 1, 5, '2026-01-22 00:37:07.645+00', NULL, NULL, NULL, 'confirmado', '4af2cef0-89ce-474f-85c0-a73c6691d1aa', NULL, NULL, NULL, 1),
	('b7a4d27f-66cc-407d-8ac6-29bde9e42d15', 'ad58a855-fa74-4c2e-825e-32c20f972136', '0d18b572-140d-4157-b0cc-df929420cdb6', 'fec26ac2-902f-44d9-80fb-efad078589f4', '720b5f4c-b516-475b-8f14-cf5d05dbee6f', 5, 4, '2026-01-22 00:40:31.534+00', NULL, NULL, NULL, 'confirmado', 'fec26ac2-902f-44d9-80fb-efad078589f4', NULL, NULL, NULL, 4),
	('32e3c331-1bf8-4543-91f5-c0086ea7dce0', 'ad58a855-fa74-4c2e-825e-32c20f972136', '0d18b572-140d-4157-b0cc-df929420cdb6', '9063b50d-8209-44fc-a020-bee3526f9b1d', '2266a177-3c20-48f6-968c-133f7463f428', 1, 5, '2026-01-22 00:33:51.619+00', NULL, NULL, NULL, 'confirmado', '2266a177-3c20-48f6-968c-133f7463f428', NULL, NULL, NULL, 2),
	('2d8c7421-2a9a-4202-9ff1-220be79299c3', 'ad58a855-fa74-4c2e-825e-32c20f972136', '53bc7af8-d65e-47eb-97a4-e0fcf9e65c42', '4af2cef0-89ce-474f-85c0-a73c6691d1aa', '7a1272ce-3421-433a-b4ce-8300daf6e28d', 2, 5, '2026-01-22 01:03:46.218+00', NULL, NULL, NULL, 'confirmado', '4af2cef0-89ce-474f-85c0-a73c6691d1aa', NULL, NULL, NULL, 4),
	('3fcba88a-ec17-460a-b2b0-abf319d95957', 'ad58a855-fa74-4c2e-825e-32c20f972136', '0d18b572-140d-4157-b0cc-df929420cdb6', 'fec26ac2-902f-44d9-80fb-efad078589f4', '43e9c439-2bec-4cb7-b1bc-9671574beb68', 5, 2, '2026-01-22 01:16:32.373+00', NULL, NULL, NULL, 'a_confirmar', 'fec26ac2-902f-44d9-80fb-efad078589f4', NULL, NULL, NULL, 5),
	('f28a3115-b980-4ed5-b7cc-a37e1d66d4bc', 'ad58a855-fa74-4c2e-825e-32c20f972136', NULL, '4af2cef0-89ce-474f-85c0-a73c6691d1aa', '720b5f4c-b516-475b-8f14-cf5d05dbee6f', 5, 1, '2026-01-22 01:17:59.244487+00', 'ac1c2acd-9429-46cc-a0b1-0145a8fefdfb', NULL, 4, 'pendiente', NULL, NULL, NULL, NULL, NULL),
	('619503d8-9397-4814-9d4c-984f7a64a11b', 'ad58a855-fa74-4c2e-825e-32c20f972136', NULL, '198a5674-f50b-459d-9971-cffcb4bc09b5', '9063b50d-8209-44fc-a020-bee3526f9b1d', 2, 5, '2026-01-22 01:17:59.244487+00', '4f99cc19-64df-4ad4-85e1-a3b83b375f59', NULL, 3, 'pendiente', NULL, NULL, NULL, NULL, NULL),
	('bc507ef8-d441-4e66-a310-b3b2687a1fce', 'ad58a855-fa74-4c2e-825e-32c20f972136', NULL, 'f1373f49-9128-43e1-bebd-d8b722fc21a6', '43e9c439-2bec-4cb7-b1bc-9671574beb68', 5, 3, '2026-01-22 04:14:27.869+00', 'dbc0354a-e3a2-4459-afea-27af7054c927', NULL, 5, 'a_confirmar', 'f1373f49-9128-43e1-bebd-d8b722fc21a6', NULL, NULL, NULL, NULL),
	('635f09d8-ed89-4716-9c0b-0c48be47008d', 'ad58a855-fa74-4c2e-825e-32c20f972136', NULL, '7a1272ce-3421-433a-b4ce-8300daf6e28d', '2266a177-3c20-48f6-968c-133f7463f428', 2, 5, '2026-01-22 04:16:19.123+00', '139c50fd-0465-4496-872b-bc2ef4c6a5b3', NULL, 2, 'confirmado', '7a1272ce-3421-433a-b4ce-8300daf6e28d', NULL, NULL, NULL, NULL),
	('14aaa796-134c-431e-88ce-92a5283a57d6', 'ad58a855-fa74-4c2e-825e-32c20f972136', '53bc7af8-d65e-47eb-97a4-e0fcf9e65c42', 'f1373f49-9128-43e1-bebd-d8b722fc21a6', '7a1272ce-3421-433a-b4ce-8300daf6e28d', 2, 5, '2026-01-21 23:37:19.381+00', NULL, NULL, NULL, 'confirmado', 'f1373f49-9128-43e1-bebd-d8b722fc21a6', NULL, NULL, NULL, 2),
	('6c5fa9f4-5cbe-47cc-85ed-06451ee38c0c', 'ad58a855-fa74-4c2e-825e-32c20f972136', '53bc7af8-d65e-47eb-97a4-e0fcf9e65c42', '22171e29-a328-43c8-9d9d-773949767fa1', '198a5674-f50b-459d-9971-cffcb4bc09b5', 5, 2, '2026-01-21 23:37:24.757+00', NULL, NULL, NULL, 'a_confirmar', '22171e29-a328-43c8-9d9d-773949767fa1', NULL, NULL, NULL, 2),
	('7869b835-8c25-4452-8fff-9136d45f6248', 'ad58a855-fa74-4c2e-825e-32c20f972136', NULL, '22171e29-a328-43c8-9d9d-773949767fa1', 'fec26ac2-902f-44d9-80fb-efad078589f4', 5, 2, '2026-01-22 12:59:51.113+00', '77036bed-04e4-427c-8636-ae79dd0a472e', NULL, 1, 'confirmado', 'fec26ac2-902f-44d9-80fb-efad078589f4', NULL, NULL, NULL, NULL),
	('62f7d2ab-f626-4c70-a9e6-bc286bd501ef', 'ad58a855-fa74-4c2e-825e-32c20f972136', '0d18b572-140d-4157-b0cc-df929420cdb6', 'fec26ac2-902f-44d9-80fb-efad078589f4', '2266a177-3c20-48f6-968c-133f7463f428', 5, 2, '2026-01-21 23:48:13.561+00', NULL, NULL, NULL, 'confirmado', '2266a177-3c20-48f6-968c-133f7463f428', NULL, NULL, NULL, 3),
	('b13f90d5-037e-43cb-8ef7-dbc22de0f1dd', 'ad58a855-fa74-4c2e-825e-32c20f972136', '53bc7af8-d65e-47eb-97a4-e0fcf9e65c42', '4af2cef0-89ce-474f-85c0-a73c6691d1aa', '198a5674-f50b-459d-9971-cffcb4bc09b5', 3, 5, '2026-01-22 00:02:21.4+00', NULL, NULL, NULL, 'a_confirmar', '4af2cef0-89ce-474f-85c0-a73c6691d1aa', NULL, NULL, NULL, 3),
	('e78c89d0-1099-4891-b326-a5bd56d2872f', 'ad58a855-fa74-4c2e-825e-32c20f972136', '0d18b572-140d-4157-b0cc-df929420cdb6', '43e9c439-2bec-4cb7-b1bc-9671574beb68', '720b5f4c-b516-475b-8f14-cf5d05dbee6f', 3, 5, '2026-01-22 00:05:31.68+00', NULL, NULL, NULL, 'confirmado', '720b5f4c-b516-475b-8f14-cf5d05dbee6f', NULL, NULL, NULL, 2),
	('742acc22-cbaa-469b-90d5-61cc03caac9b', 'ad58a855-fa74-4c2e-825e-32c20f972136', '0d18b572-140d-4157-b0cc-df929420cdb6', '9063b50d-8209-44fc-a020-bee3526f9b1d', '43e9c439-2bec-4cb7-b1bc-9671574beb68', 5, 2, '2026-01-22 00:05:37.369+00', NULL, NULL, NULL, 'confirmado', '9063b50d-8209-44fc-a020-bee3526f9b1d', NULL, NULL, NULL, 3),
	('2a19c57d-8e98-4705-a532-85711160f0b4', 'ad58a855-fa74-4c2e-825e-32c20f972136', '0d18b572-140d-4157-b0cc-df929420cdb6', '2266a177-3c20-48f6-968c-133f7463f428', '43e9c439-2bec-4cb7-b1bc-9671574beb68', 5, 2, '2026-01-22 00:34:08.933+00', NULL, NULL, NULL, 'a_confirmar', '2266a177-3c20-48f6-968c-133f7463f428', NULL, NULL, NULL, 4),
	('2d6a3dca-a871-4a2e-a692-65c32b93395c', 'ad58a855-fa74-4c2e-825e-32c20f972136', '0d18b572-140d-4157-b0cc-df929420cdb6', '720b5f4c-b516-475b-8f14-cf5d05dbee6f', '9063b50d-8209-44fc-a020-bee3526f9b1d', 3, 5, '2026-01-21 22:46:18.897+00', NULL, NULL, NULL, 'confirmado', NULL, NULL, NULL, NULL, 5),
	('cc593cc3-b6dd-4a98-a93a-a595e03133b2', 'ad58a855-fa74-4c2e-825e-32c20f972136', '53bc7af8-d65e-47eb-97a4-e0fcf9e65c42', '7a1272ce-3421-433a-b4ce-8300daf6e28d', '22171e29-a328-43c8-9d9d-773949767fa1', 4, 5, '2026-01-22 00:36:56.998+00', NULL, NULL, NULL, 'confirmado', '7a1272ce-3421-433a-b4ce-8300daf6e28d', NULL, NULL, NULL, 5),
	('01af07bf-6efb-4622-816d-90c152ead0a6', 'ad58a855-fa74-4c2e-825e-32c20f972136', '53bc7af8-d65e-47eb-97a4-e0fcf9e65c42', '198a5674-f50b-459d-9971-cffcb4bc09b5', 'f1373f49-9128-43e1-bebd-d8b722fc21a6', 4, 5, '2026-01-22 00:57:13.569+00', NULL, NULL, NULL, 'a_confirmar', 'f1373f49-9128-43e1-bebd-d8b722fc21a6', NULL, NULL, NULL, 4),
	('b0ff04ec-b1b9-4d3d-992d-94e304d5856c', 'ad58a855-fa74-4c2e-825e-32c20f972136', '53bc7af8-d65e-47eb-97a4-e0fcf9e65c42', '7a1272ce-3421-433a-b4ce-8300daf6e28d', '198a5674-f50b-459d-9971-cffcb4bc09b5', 4, 5, '2026-01-22 04:15:23.257+00', NULL, NULL, NULL, 'a_confirmar', '7a1272ce-3421-433a-b4ce-8300daf6e28d', NULL, NULL, NULL, 1),
	('11ae6883-fb4a-4a00-98af-c055b6e9d7fd', 'ad58a855-fa74-4c2e-825e-32c20f972136', '53bc7af8-d65e-47eb-97a4-e0fcf9e65c42', '4af2cef0-89ce-474f-85c0-a73c6691d1aa', 'f1373f49-9128-43e1-bebd-d8b722fc21a6', 5, 0, '2026-01-21 23:09:12.59+00', NULL, NULL, NULL, 'confirmado', 'f1373f49-9128-43e1-bebd-d8b722fc21a6', NULL, NULL, NULL, 5),
	('17871021-05f1-4b3a-bc14-ea2f88c10330', 'ad58a855-fa74-4c2e-825e-32c20f972136', '0d18b572-140d-4157-b0cc-df929420cdb6', 'fec26ac2-902f-44d9-80fb-efad078589f4', '9063b50d-8209-44fc-a020-bee3526f9b1d', 4, 5, '2026-01-21 23:30:21.533+00', NULL, NULL, NULL, 'confirmado', 'fec26ac2-902f-44d9-80fb-efad078589f4', NULL, NULL, NULL, 1),
	('fa94f00f-b3c1-466e-a3af-47e06fde20ce', 'ad58a855-fa74-4c2e-825e-32c20f972136', '0d18b572-140d-4157-b0cc-df929420cdb6', '720b5f4c-b516-475b-8f14-cf5d05dbee6f', '2266a177-3c20-48f6-968c-133f7463f428', 3, 5, '2026-01-22 00:04:17.707+00', NULL, NULL, NULL, 'confirmado', '2266a177-3c20-48f6-968c-133f7463f428', NULL, NULL, NULL, 1),
	('858666fe-bc70-4243-b1da-ed91c8a3cb54', 'ad58a855-fa74-4c2e-825e-32c20f972136', '53bc7af8-d65e-47eb-97a4-e0fcf9e65c42', '22171e29-a328-43c8-9d9d-773949767fa1', 'f1373f49-9128-43e1-bebd-d8b722fc21a6', 5, 2, '2026-01-22 00:35:35.929+00', NULL, NULL, NULL, 'confirmado', 'f1373f49-9128-43e1-bebd-d8b722fc21a6', NULL, NULL, NULL, 3);


--
-- Data for Name: posiciones_manual; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: tracking_eventos; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."tracking_eventos" ("id", "torneo_id", "pareja_id", "jugador_nombre", "tipo_evento", "metadata", "created_at") VALUES
	('bda22875-a793-400d-90a8-529ec2d61680', 'ad58a855-fa74-4c2e-825e-32c20f972136', 'f1373f49-9128-43e1-bebd-d8b722fc21a6', 'Tincho', 'visita', '{"grupo": "Expectativa", "companero": "Lau", "timestamp": "2026-01-21T03:26:19.463Z", "pareja_nombre": "Tincho - Lau"}', '2026-01-21 03:26:19.955422+00'),
	('e26698c0-3e8f-48df-8f66-cb94298ad60d', 'ad58a855-fa74-4c2e-825e-32c20f972136', 'f1373f49-9128-43e1-bebd-d8b722fc21a6', 'Tincho', 'visita', '{"grupo": "Expectativa", "companero": "Lau", "timestamp": "2026-01-21T03:28:38.539Z", "pareja_nombre": "Tincho - Lau"}', '2026-01-21 03:28:39.026445+00'),
	('d152f218-f050-4b15-9832-26769b8a4f91', 'ad58a855-fa74-4c2e-825e-32c20f972136', '198a5674-f50b-459d-9971-cffcb4bc09b5', 'Max', 'visita', '{"grupo": "Expectativa", "companero": "Iani", "timestamp": "2026-01-21T13:49:28.817Z", "pareja_nombre": "Max - Iani"}', '2026-01-21 13:49:29.234986+00'),
	('2a8adc31-41ec-4f68-bddd-581a926f29c8', 'ad58a855-fa74-4c2e-825e-32c20f972136', '198a5674-f50b-459d-9971-cffcb4bc09b5', 'Max', 'visita', '{"grupo": "Expectativa", "companero": "Iani", "timestamp": "2026-01-21T14:03:20.077Z", "pareja_nombre": "Max - Iani"}', '2026-01-21 14:03:20.233173+00'),
	('7c179012-776c-40e1-ab6f-3ee78aa2adf3', 'ad58a855-fa74-4c2e-825e-32c20f972136', '7a1272ce-3421-433a-b4ce-8300daf6e28d', 'Seba T', 'visita', '{"grupo": "Expectativa", "companero": "Dani", "timestamp": "2026-01-21T14:03:56.578Z", "pareja_nombre": "Seba T - Dani"}', '2026-01-21 14:03:56.92733+00'),
	('d684c6cc-a401-4af6-b13d-daea5034edb0', 'ad58a855-fa74-4c2e-825e-32c20f972136', '198a5674-f50b-459d-9971-cffcb4bc09b5', 'Max', 'visita', '{"grupo": "Expectativa", "companero": "Iani", "timestamp": "2026-01-21T14:46:43.939Z", "pareja_nombre": "Max - Iani"}', '2026-01-21 14:46:44.375571+00'),
	('87a3d16f-b532-44a0-9d1a-53106a879faf', 'ad58a855-fa74-4c2e-825e-32c20f972136', '7a1272ce-3421-433a-b4ce-8300daf6e28d', 'Seba T', 'visita', '{"grupo": "Expectativa", "companero": "Dani", "timestamp": "2026-01-21T14:47:17.023Z", "pareja_nombre": "Seba T - Dani"}', '2026-01-21 14:47:17.253154+00'),
	('dcbae418-7b2e-4034-b36d-500ef81c9426', 'ad58a855-fa74-4c2e-825e-32c20f972136', '198a5674-f50b-459d-9971-cffcb4bc09b5', 'Max', 'carga_resultado', '{"games_a": 4, "games_b": 6, "resultado": "4-6", "timestamp": "2026-01-21T14:47:56.288Z", "partido_id": "b0ff04ec-b1b9-4d3d-992d-94e304d5856c", "pareja_nombre": "Max - Iani"}', '2026-01-21 14:48:10.36665+00'),
	('0a0e156c-c72c-4f44-b68d-c6cbd05dcce8', 'ad58a855-fa74-4c2e-825e-32c20f972136', '7a1272ce-3421-433a-b4ce-8300daf6e28d', 'Seba T', 'carga_resultado', '{"games_a": 4, "games_b": 6, "resultado": "4-6", "timestamp": "2026-01-21T14:48:29.982Z", "partido_id": "b0ff04ec-b1b9-4d3d-992d-94e304d5856c", "pareja_nombre": "Seba T - Dani"}', '2026-01-21 14:48:45.094402+00'),
	('211144df-5ad0-4c37-b9bf-192c724871a3', 'ad58a855-fa74-4c2e-825e-32c20f972136', '2266a177-3c20-48f6-968c-133f7463f428', 'Nico', 'visita', '{"grupo": "Realidad", "companero": "Ani", "timestamp": "2026-01-21T14:49:37.284Z", "pareja_nombre": "Nico - Ani"}', '2026-01-21 14:49:37.427316+00'),
	('e0296e0d-aa3b-4490-9b0b-43377a19e8e1', 'ad58a855-fa74-4c2e-825e-32c20f972136', '198a5674-f50b-459d-9971-cffcb4bc09b5', 'Max', 'visita', '{"grupo": "Expectativa", "companero": "Iani", "timestamp": "2026-01-21T14:50:51.849Z", "pareja_nombre": "Max - Iani"}', '2026-01-21 14:50:52.122272+00'),
	('46cc3be3-67ec-4c45-b1d0-1a6981b4e5d8', 'ad58a855-fa74-4c2e-825e-32c20f972136', '2266a177-3c20-48f6-968c-133f7463f428', 'Nico', 'visita', '{"grupo": "Realidad", "companero": "Ani", "timestamp": "2026-01-21T14:53:06.743Z", "pareja_nombre": "Nico - Ani"}', '2026-01-21 14:53:06.874239+00'),
	('960200cd-1250-488d-b6ad-114f4ed53bf4', 'ad58a855-fa74-4c2e-825e-32c20f972136', '2266a177-3c20-48f6-968c-133f7463f428', 'Nico', 'carga_resultado', '{"games_a": 4, "games_b": 6, "resultado": "4-6", "timestamp": "2026-01-21T14:55:24.682Z", "partido_id": "fa94f00f-b3c1-466e-a3af-47e06fde20ce", "pareja_nombre": "Nico - Ani"}', '2026-01-21 14:55:33.126826+00'),
	('b06cc396-610c-4527-a133-59664076c327', 'ad58a855-fa74-4c2e-825e-32c20f972136', '7a1272ce-3421-433a-b4ce-8300daf6e28d', 'Seba T', 'visita', '{"grupo": "Expectativa", "companero": "Dani", "timestamp": "2026-01-21T14:56:07.842Z", "pareja_nombre": "Seba T - Dani"}', '2026-01-21 14:56:07.976785+00'),
	('db939f0b-8c17-4a95-859b-30b0600d9c71', 'ad58a855-fa74-4c2e-825e-32c20f972136', '7a1272ce-3421-433a-b4ce-8300daf6e28d', 'Seba T', 'carga_resultado', '{"games_a": 6, "games_b": 3, "resultado": "6-3", "timestamp": "2026-01-21T14:56:35.869Z", "partido_id": "14aaa796-134c-431e-88ce-92a5283a57d6", "pareja_nombre": "Seba T - Dani"}', '2026-01-21 14:56:49.68677+00'),
	('960f84a7-cab6-4fb8-82bd-343c80e732cc', 'ad58a855-fa74-4c2e-825e-32c20f972136', 'f1373f49-9128-43e1-bebd-d8b722fc21a6', 'Tincho', 'carga_resultado', '{"games_a": 6, "games_b": 3, "resultado": "6-3", "timestamp": "2026-01-21T14:57:54.277Z", "partido_id": "14aaa796-134c-431e-88ce-92a5283a57d6", "pareja_nombre": "Tincho - Lau"}', '2026-01-21 14:57:56.087338+00'),
	('13c1a34a-c626-4ae9-b3ea-0d54ae7daadc', 'ad58a855-fa74-4c2e-825e-32c20f972136', 'f1373f49-9128-43e1-bebd-d8b722fc21a6', 'Tincho', 'carga_resultado', '{"games_a": 6, "games_b": 3, "resultado": "6-3", "timestamp": "2026-01-21T14:58:11.861Z", "partido_id": "858666fe-bc70-4243-b1da-ed91c8a3cb54", "pareja_nombre": "Tincho - Lau"}', '2026-01-21 14:58:14.612529+00'),
	('611234bb-b68f-4b41-af16-aef11a06bb08', 'ad58a855-fa74-4c2e-825e-32c20f972136', '2266a177-3c20-48f6-968c-133f7463f428', 'Nico', 'visita', '{"grupo": "Realidad", "companero": "Ani", "timestamp": "2026-01-21T14:58:25.173Z", "pareja_nombre": "Nico - Ani"}', '2026-01-21 14:58:25.311702+00'),
	('61de7ca4-6cf7-41bf-a3d0-47f23e4c95ff', 'ad58a855-fa74-4c2e-825e-32c20f972136', '198a5674-f50b-459d-9971-cffcb4bc09b5', 'Max', 'visita', '{"grupo": "Expectativa", "companero": "Iani", "timestamp": "2026-01-21T15:00:12.876Z", "pareja_nombre": "Max - Iani"}', '2026-01-21 15:00:13.012029+00'),
	('7737ea9f-723a-4a25-b152-6d4a44f11827', 'ad58a855-fa74-4c2e-825e-32c20f972136', 'f1373f49-9128-43e1-bebd-d8b722fc21a6', 'Tincho', 'carga_resultado', '{"games_a": 0, "games_b": 6, "resultado": "0-6", "timestamp": "2026-01-21T15:17:52.794Z", "partido_id": "01af07bf-6efb-4622-816d-90c152ead0a6", "pareja_nombre": "Tincho - Lau"}', '2026-01-21 15:17:55.10372+00'),
	('5cbabca4-bde7-486a-a3bb-44243f23aa49', 'ad58a855-fa74-4c2e-825e-32c20f972136', 'f1373f49-9128-43e1-bebd-d8b722fc21a6', 'Tincho', 'carga_resultado', '{"games_a": 7, "games_b": 6, "resultado": "7-6", "timestamp": "2026-01-21T15:23:54.294Z", "partido_id": "11ae6883-fb4a-4a00-98af-c055b6e9d7fd", "pareja_nombre": "Tincho - Lau"}', '2026-01-21 15:23:54.328408+00'),
	('7faa7500-4535-40b9-9aea-2446d5aae4a3', 'ad58a855-fa74-4c2e-825e-32c20f972136', 'f1373f49-9128-43e1-bebd-d8b722fc21a6', 'Tincho', 'carga_resultado', '{"games_a": 5, "games_b": 6, "resultado": "5-6", "timestamp": "2026-01-21T15:48:56.853Z", "partido_id": "14aaa796-134c-431e-88ce-92a5283a57d6", "pareja_nombre": "Tincho - Lau"}', '2026-01-21 15:48:56.876234+00'),
	('8b32d29a-37fc-46d1-a915-b1f6cf8f79d7', 'ad58a855-fa74-4c2e-825e-32c20f972136', 'fec26ac2-902f-44d9-80fb-efad078589f4', 'Ari', 'visita', '{"grupo": "Realidad", "companero": "Jenny", "timestamp": "2026-01-21T15:57:20.249Z", "pareja_nombre": "Ari - Jenny"}', '2026-01-21 15:57:20.285443+00'),
	('a09f6c81-0fe5-4284-805d-26c9b8af2861', 'ad58a855-fa74-4c2e-825e-32c20f972136', 'fec26ac2-902f-44d9-80fb-efad078589f4', 'Ari', 'visita', '{"grupo": "Realidad", "companero": "Jenny", "timestamp": "2026-01-21T15:57:47.378Z", "pareja_nombre": "Ari - Jenny"}', '2026-01-21 15:57:47.430436+00'),
	('f07464e8-5421-41c9-89bf-bb073c266099', 'ad58a855-fa74-4c2e-825e-32c20f972136', 'fec26ac2-902f-44d9-80fb-efad078589f4', 'Ari', 'visita', '{"grupo": "Realidad", "companero": "Jenny", "timestamp": "2026-01-21T16:00:48.013Z", "pareja_nombre": "Ari - Jenny"}', '2026-01-21 16:00:48.077532+00'),
	('19541dbf-d528-48d7-9980-bc9867a0519f', 'ad58a855-fa74-4c2e-825e-32c20f972136', 'fec26ac2-902f-44d9-80fb-efad078589f4', 'Ari', 'visita', '{"grupo": "Realidad", "companero": "Jenny", "timestamp": "2026-01-21T16:01:37.599Z", "pareja_nombre": "Ari - Jenny"}', '2026-01-21 16:01:37.697303+00'),
	('4f9f8576-bba5-46ad-b229-c463a42bbfa3', 'ad58a855-fa74-4c2e-825e-32c20f972136', 'fec26ac2-902f-44d9-80fb-efad078589f4', 'Ari', 'visita', '{"grupo": "Realidad", "companero": "Jenny", "timestamp": "2026-01-21T16:02:14.806Z", "pareja_nombre": "Ari - Jenny"}', '2026-01-21 16:02:14.864738+00'),
	('e1d7e27f-48fd-48bc-a73f-45213dd32db6', 'ad58a855-fa74-4c2e-825e-32c20f972136', 'fec26ac2-902f-44d9-80fb-efad078589f4', 'Ari', 'visita', '{"grupo": "Realidad", "companero": "Jenny", "timestamp": "2026-01-21T16:02:47.231Z", "pareja_nombre": "Ari - Jenny"}', '2026-01-21 16:02:47.320784+00'),
	('33adeb74-451f-40de-bcbe-305322463149', 'ad58a855-fa74-4c2e-825e-32c20f972136', 'fec26ac2-902f-44d9-80fb-efad078589f4', 'Ari', 'visita', '{"grupo": "Realidad", "companero": "Jenny", "timestamp": "2026-01-21T16:02:53.306Z", "pareja_nombre": "Ari - Jenny"}', '2026-01-21 16:02:53.353689+00'),
	('9e3eba4d-e09e-4641-ad53-5e107531ce07', 'ad58a855-fa74-4c2e-825e-32c20f972136', 'fec26ac2-902f-44d9-80fb-efad078589f4', 'Ari', 'visita', '{"grupo": "Realidad", "companero": "Jenny", "timestamp": "2026-01-21T16:13:37.885Z", "pareja_nombre": "Ari - Jenny"}', '2026-01-21 16:13:37.959873+00'),
	('cecbbdfb-3a5e-4610-af62-0683d1b057e3', 'ad58a855-fa74-4c2e-825e-32c20f972136', 'fec26ac2-902f-44d9-80fb-efad078589f4', 'Ari', 'visita', '{"grupo": "Realidad", "companero": "Jenny", "timestamp": "2026-01-21T16:13:45.082Z", "pareja_nombre": "Ari - Jenny"}', '2026-01-21 16:13:45.304265+00'),
	('f99bf21e-6df3-42cf-a840-b00b2cb72e56', 'ad58a855-fa74-4c2e-825e-32c20f972136', 'fec26ac2-902f-44d9-80fb-efad078589f4', 'Ari', 'visita', '{"grupo": "Realidad", "companero": "Jenny", "timestamp": "2026-01-21T16:15:06.800Z", "pareja_nombre": "Ari - Jenny"}', '2026-01-21 16:15:06.890469+00'),
	('8f136151-df20-4215-aa9d-ace5d4b19cfd', 'ad58a855-fa74-4c2e-825e-32c20f972136', 'fec26ac2-902f-44d9-80fb-efad078589f4', 'Ari', 'visita', '{"grupo": "Realidad", "companero": "Jenny", "timestamp": "2026-01-21T16:15:13.378Z", "pareja_nombre": "Ari - Jenny"}', '2026-01-21 16:15:13.466582+00'),
	('396813b1-266a-4a0f-adf4-aee1809e559d', 'ad58a855-fa74-4c2e-825e-32c20f972136', 'fec26ac2-902f-44d9-80fb-efad078589f4', 'Ari', 'visita', '{"grupo": "Realidad", "companero": "Jenny", "timestamp": "2026-01-21T16:16:19.972Z", "pareja_nombre": "Ari - Jenny"}', '2026-01-21 16:16:20.024917+00'),
	('6f602548-5074-4124-a689-e4352acd8e11', 'ad58a855-fa74-4c2e-825e-32c20f972136', 'fec26ac2-902f-44d9-80fb-efad078589f4', 'Ari', 'visita', '{"grupo": "Realidad", "companero": "Jenny", "timestamp": "2026-01-21T16:16:26.432Z", "pareja_nombre": "Ari - Jenny"}', '2026-01-21 16:16:26.517901+00'),
	('1b9a59c1-4eef-4bba-a2fd-d910e1a30c40', 'ad58a855-fa74-4c2e-825e-32c20f972136', '9063b50d-8209-44fc-a020-bee3526f9b1d', 'Ger', 'visita', '{"grupo": "Realidad", "companero": "Pau", "timestamp": "2026-01-21T17:23:10.918Z", "pareja_nombre": "Ger - Pau"}', '2026-01-21 17:23:10.957173+00'),
	('2efb6e05-1e1d-4d9f-b349-7372fc6622e1', 'ad58a855-fa74-4c2e-825e-32c20f972136', 'f1373f49-9128-43e1-bebd-d8b722fc21a6', 'Tincho', 'visita', '{"grupo": "Expectativa", "companero": "Lau", "timestamp": "2026-01-21T17:46:49.032Z", "pareja_nombre": "Tincho - Lau"}', '2026-01-21 17:46:49.245015+00'),
	('30a0b105-a0e1-4b4a-bb9e-62abccbf238e', 'ad58a855-fa74-4c2e-825e-32c20f972136', 'f1373f49-9128-43e1-bebd-d8b722fc21a6', 'Tincho', 'visita', '{"grupo": "Expectativa", "companero": "Lau", "timestamp": "2026-01-21T18:14:45.727Z", "pareja_nombre": "Tincho - Lau"}', '2026-01-21 18:14:45.962618+00'),
	('2e4c9fdc-f6fb-459f-aed3-ac22444dbef3', 'ad58a855-fa74-4c2e-825e-32c20f972136', '198a5674-f50b-459d-9971-cffcb4bc09b5', 'Max', 'visita', '{"grupo": "Expectativa", "companero": "Iani", "timestamp": "2026-01-21T18:39:29.868Z", "pareja_nombre": "Max - Iani"}', '2026-01-21 18:39:30.094561+00'),
	('b770a392-2a58-45dc-873a-64a44483cdb6', 'ad58a855-fa74-4c2e-825e-32c20f972136', '7a1272ce-3421-433a-b4ce-8300daf6e28d', 'Seba T', 'visita', '{"grupo": "Expectativa", "companero": "Dani", "timestamp": "2026-01-21T18:40:21.944Z", "pareja_nombre": "Seba T - Dani"}', '2026-01-21 18:40:22.307084+00'),
	('b6f4e1ed-1cd3-412f-9d0c-72f6454b7cfa', 'ad58a855-fa74-4c2e-825e-32c20f972136', '198a5674-f50b-459d-9971-cffcb4bc09b5', 'Max', 'carga_resultado', '{"games_a": 4, "games_b": 6, "resultado": "4-6", "timestamp": "2026-01-21T18:41:01.970Z", "partido_id": "b0ff04ec-b1b9-4d3d-992d-94e304d5856c", "pareja_nombre": "Max - Iani"}', '2026-01-21 18:41:02.106074+00'),
	('ee030713-2a51-4975-b825-1050f302612a', 'ad58a855-fa74-4c2e-825e-32c20f972136', '7a1272ce-3421-433a-b4ce-8300daf6e28d', 'Seba T', 'carga_resultado', '{"games_a": 6, "games_b": 4, "resultado": "6-4", "timestamp": "2026-01-21T18:41:02.621Z", "partido_id": "b0ff04ec-b1b9-4d3d-992d-94e304d5856c", "pareja_nombre": "Seba T - Dani"}', '2026-01-21 18:41:02.719026+00'),
	('7fb49bfe-31b6-4f2c-959d-e7c61f15498c', 'ad58a855-fa74-4c2e-825e-32c20f972136', '9063b50d-8209-44fc-a020-bee3526f9b1d', 'Ger', 'carga_resultado', '{"games_a": 0, "games_b": 6, "resultado": "0-6", "timestamp": "2026-01-21T18:54:13.848Z", "partido_id": "17871021-05f1-4b3a-bc14-ea2f88c10330", "pareja_nombre": "Ger - Pau"}', '2026-01-21 18:54:13.849411+00'),
	('5626819f-6d27-4a06-b731-1d78a17f8297', 'ad58a855-fa74-4c2e-825e-32c20f972136', '9063b50d-8209-44fc-a020-bee3526f9b1d', 'Ger', 'carga_resultado', '{"games_a": 6, "games_b": 0, "resultado": "6-0", "timestamp": "2026-01-21T18:54:31.902Z", "partido_id": "32e3c331-1bf8-4543-91f5-c0086ea7dce0", "pareja_nombre": "Ger - Pau"}', '2026-01-21 18:54:31.904374+00'),
	('21e698cf-797c-4861-a268-ac0f593ccd7c', 'ad58a855-fa74-4c2e-825e-32c20f972136', '198a5674-f50b-459d-9971-cffcb4bc09b5', 'Max', 'visita', '{"grupo": "Expectativa", "companero": "Iani", "timestamp": "2026-01-21T19:10:04.163Z", "pareja_nombre": "Max - Iani"}', '2026-01-21 19:10:04.361512+00'),
	('2296b5c1-4038-4108-a01e-a342a1b23279', 'ad58a855-fa74-4c2e-825e-32c20f972136', '198a5674-f50b-459d-9971-cffcb4bc09b5', 'Max', 'carga_resultado', '{"games_a": 6, "games_b": 0, "resultado": "6-0", "timestamp": "2026-01-21T19:11:16.396Z", "partido_id": "445f4fa1-74b6-4736-ac8c-40e47fe2eba6", "pareja_nombre": "Max - Iani"}', '2026-01-21 19:11:16.551682+00'),
	('d4284124-08c7-4176-bf84-82da76892931', 'ad58a855-fa74-4c2e-825e-32c20f972136', '7a1272ce-3421-433a-b4ce-8300daf6e28d', 'Seba T', 'visita', '{"grupo": "Expectativa", "companero": "Dani", "timestamp": "2026-01-21T19:12:11.298Z", "pareja_nombre": "Seba T - Dani"}', '2026-01-21 19:12:11.452572+00'),
	('8d5c08fa-5b39-43d6-8e21-6b0f9288395a', 'ad58a855-fa74-4c2e-825e-32c20f972136', '7a1272ce-3421-433a-b4ce-8300daf6e28d', 'Seba T', 'carga_resultado', '{"games_a": 0, "games_b": 6, "resultado": "0-6", "timestamp": "2026-01-21T19:14:16.591Z", "partido_id": "920af7c2-c835-45bd-9971-4b0492431d23", "pareja_nombre": "Seba T - Dani"}', '2026-01-21 19:14:16.748224+00'),
	('effc8b4c-287a-47a9-b9cb-e2663ec31e37', 'ad58a855-fa74-4c2e-825e-32c20f972136', '43e9c439-2bec-4cb7-b1bc-9671574beb68', 'Lean', 'visita', '{"grupo": "Realidad", "companero": "Mica", "timestamp": "2026-01-21T19:15:48.588Z", "pareja_nombre": "Lean - Mica"}', '2026-01-21 19:15:48.831054+00'),
	('60b978b2-c1f5-4e3a-88af-e44723461920', 'ad58a855-fa74-4c2e-825e-32c20f972136', '43e9c439-2bec-4cb7-b1bc-9671574beb68', 'Lean', 'carga_resultado', '{"games_a": 0, "games_b": 6, "resultado": "0-6", "timestamp": "2026-01-21T19:17:04.956Z", "partido_id": "920af7c2-c835-45bd-9971-4b0492431d23", "pareja_nombre": "Lean - Mica"}', '2026-01-21 19:17:05.276075+00'),
	('026370b0-e1e8-4f92-af60-541647f3bdc0', 'ad58a855-fa74-4c2e-825e-32c20f972136', 'f1373f49-9128-43e1-bebd-d8b722fc21a6', 'Tincho', 'visita', '{"grupo": "Expectativa", "companero": "Lau", "timestamp": "2026-01-21T19:27:47.870Z", "pareja_nombre": "Tincho - Lau"}', '2026-01-21 19:27:48.115086+00'),
	('ead2063e-c89a-41cd-8d2a-6770a0fbbab7', 'ad58a855-fa74-4c2e-825e-32c20f972136', '198a5674-f50b-459d-9971-cffcb4bc09b5', 'Max', 'visita', '{"grupo": "Expectativa", "companero": "Iani", "timestamp": "2026-01-21T19:32:21.548Z", "pareja_nombre": "Max - Iani"}', '2026-01-21 19:32:21.709475+00'),
	('811c34c9-85da-411e-9c21-a70494be18c3', 'ad58a855-fa74-4c2e-825e-32c20f972136', '198a5674-f50b-459d-9971-cffcb4bc09b5', 'Max', 'carga_resultado', '{"games_a": 2, "games_b": 6, "resultado": "2-6", "timestamp": "2026-01-21T19:32:54.966Z", "partido_id": "b0ff04ec-b1b9-4d3d-992d-94e304d5856c", "pareja_nombre": "Max - Iani"}', '2026-01-21 19:32:55.09686+00'),
	('e4d21981-4a75-4faa-ba30-440f0f457fba', 'ad58a855-fa74-4c2e-825e-32c20f972136', '198a5674-f50b-459d-9971-cffcb4bc09b5', 'Max', 'carga_resultado', '{"games_a": 0, "games_b": 6, "resultado": "0-6", "timestamp": "2026-01-21T19:33:52.959Z", "partido_id": "6c5fa9f4-5cbe-47cc-85ed-06451ee38c0c", "pareja_nombre": "Max - Iani"}', '2026-01-21 19:33:53.080727+00'),
	('c3e241da-2d89-469e-8778-de3d7af7dfba', 'ad58a855-fa74-4c2e-825e-32c20f972136', '43e9c439-2bec-4cb7-b1bc-9671574beb68', 'Lean', 'visita', '{"grupo": "Realidad", "companero": "Mica", "timestamp": "2026-01-21T19:36:59.551Z", "pareja_nombre": "Lean - Mica"}', '2026-01-21 19:36:59.793055+00'),
	('0b34cc1c-a1d9-4154-b71a-993bf98705ff', 'ad58a855-fa74-4c2e-825e-32c20f972136', '43e9c439-2bec-4cb7-b1bc-9671574beb68', 'Lean', 'carga_resultado', '{"games_a": 6, "games_b": 3, "resultado": "6-3", "timestamp": "2026-01-21T19:37:48.919Z", "partido_id": "e78c89d0-1099-4891-b326-a5bd56d2872f", "pareja_nombre": "Lean - Mica"}', '2026-01-21 19:37:49.036521+00'),
	('a86bc2b3-5e1b-4011-a2b8-f5dc1d7bbdd9', 'ad58a855-fa74-4c2e-825e-32c20f972136', '4af2cef0-89ce-474f-85c0-a73c6691d1aa', 'Diego', 'visita', '{"grupo": "Expectativa", "companero": "Jesi", "timestamp": "2026-01-21T19:45:04.657Z", "pareja_nombre": "Diego - Jesi"}', '2026-01-21 19:45:05.035271+00'),
	('1f6c75b6-2c38-4481-b575-ff68b0a587c8', 'ad58a855-fa74-4c2e-825e-32c20f972136', '4af2cef0-89ce-474f-85c0-a73c6691d1aa', 'Diego', 'carga_resultado', '{"games_a": 6, "games_b": 1, "resultado": "6-1", "timestamp": "2026-01-21T20:01:33.450Z", "partido_id": "6b6a3f20-4ff8-452f-96f2-9e77d2a7fe16", "pareja_nombre": "Diego - Jesi"}', '2026-01-21 20:01:33.577187+00'),
	('9e24b8e9-73c8-4f1f-85d5-b0ea157b3e9f', 'ad58a855-fa74-4c2e-825e-32c20f972136', '4af2cef0-89ce-474f-85c0-a73c6691d1aa', 'Diego', 'carga_resultado', '{"games_a": 2, "games_b": 6, "resultado": "2-6", "timestamp": "2026-01-21T20:02:30.128Z", "partido_id": "b13f90d5-037e-43cb-8ef7-dbc22de0f1dd", "pareja_nombre": "Diego - Jesi"}', '2026-01-21 20:02:30.263368+00'),
	('86594ad5-e09d-42ab-ab62-48b1f9f18923', 'ad58a855-fa74-4c2e-825e-32c20f972136', '4af2cef0-89ce-474f-85c0-a73c6691d1aa', 'Diego', 'carga_resultado', '{"games_a": 6, "games_b": 3, "resultado": "6-3", "timestamp": "2026-01-21T20:04:19.829Z", "partido_id": "2d8c7421-2a9a-4202-9ff1-220be79299c3", "pareja_nombre": "Diego - Jesi"}', '2026-01-21 20:04:19.974762+00'),
	('ee262df2-7390-42e5-b029-9b62a0f1504f', 'ad58a855-fa74-4c2e-825e-32c20f972136', '4af2cef0-89ce-474f-85c0-a73c6691d1aa', 'Diego', 'carga_resultado', '{"games_a": 6, "games_b": 4, "resultado": "6-4", "timestamp": "2026-01-21T20:05:52.746Z", "partido_id": "11ae6883-fb4a-4a00-98af-c055b6e9d7fd", "pareja_nombre": "Diego - Jesi"}', '2026-01-21 20:05:52.868546+00'),
	('6e36adee-c924-4856-acb7-1d10df653aab', 'ad58a855-fa74-4c2e-825e-32c20f972136', '4af2cef0-89ce-474f-85c0-a73c6691d1aa', 'Diego', 'carga_resultado', '{"games_a": 6, "games_b": 2, "resultado": "6-2", "timestamp": "2026-01-21T20:06:59.841Z", "partido_id": "7ef5d210-971b-439e-a9dc-c8dd1f332800", "pareja_nombre": "Diego - Jesi"}', '2026-01-21 20:07:00.003729+00'),
	('97dfd623-459c-4ee7-b8e4-e19a3d3b0823', 'ad58a855-fa74-4c2e-825e-32c20f972136', '198a5674-f50b-459d-9971-cffcb4bc09b5', 'Max', 'visita', '{"grupo": "Expectativa", "companero": "Iani", "timestamp": "2026-01-21T20:07:52.950Z", "pareja_nombre": "Max - Iani"}', '2026-01-21 20:07:53.13155+00'),
	('58c2a89e-d1b9-43da-9ecf-fdcf85e7ae5c', 'ad58a855-fa74-4c2e-825e-32c20f972136', '198a5674-f50b-459d-9971-cffcb4bc09b5', 'Max', 'carga_resultado', '{"games_a": 2, "games_b": 6, "resultado": "2-6", "timestamp": "2026-01-21T20:08:37.596Z", "partido_id": "b13f90d5-037e-43cb-8ef7-dbc22de0f1dd", "pareja_nombre": "Max - Iani"}', '2026-01-21 20:08:37.729932+00'),
	('48c42268-300e-4370-97d6-6a5ded1f53ca', 'ad58a855-fa74-4c2e-825e-32c20f972136', '198a5674-f50b-459d-9971-cffcb4bc09b5', 'Max', 'carga_resultado', '{"games_a": 6, "games_b": 4, "resultado": "6-4", "timestamp": "2026-01-21T20:10:15.274Z", "partido_id": "01af07bf-6efb-4622-816d-90c152ead0a6", "pareja_nombre": "Max - Iani"}', '2026-01-21 20:10:15.515867+00'),
	('47704db4-c692-4669-bbc3-5d78a96ab83b', 'ad58a855-fa74-4c2e-825e-32c20f972136', '198a5674-f50b-459d-9971-cffcb4bc09b5', 'Max', 'carga_resultado', '{"games_a": 6, "games_b": 3, "resultado": "6-3", "timestamp": "2026-01-21T20:11:20.586Z", "partido_id": "445f4fa1-74b6-4736-ac8c-40e47fe2eba6", "pareja_nombre": "Max - Iani"}', '2026-01-21 20:11:20.733419+00'),
	('ffec9045-4006-4bd9-8a0a-6b68bebc3dfc', 'ad58a855-fa74-4c2e-825e-32c20f972136', '4af2cef0-89ce-474f-85c0-a73c6691d1aa', 'Diego', 'visita', '{"grupo": "Expectativa", "companero": "Jesi", "timestamp": "2026-01-21T22:10:53.475Z", "pareja_nombre": "Diego - Jesi"}', '2026-01-21 22:10:54.147214+00'),
	('8146519f-28cc-4c87-b1f1-2b14dd146f2a', 'ad58a855-fa74-4c2e-825e-32c20f972136', '2266a177-3c20-48f6-968c-133f7463f428', 'Ani', 'visita', '{"grupo": "Realidad", "companero": "Nico", "timestamp": "2026-01-21T22:13:54.611Z", "pareja_nombre": "Nico - Ani"}', '2026-01-21 22:13:54.940476+00'),
	('b0d9a55a-d1c5-4486-a2bc-c4a5892ed6ec', 'ad58a855-fa74-4c2e-825e-32c20f972136', 'f1373f49-9128-43e1-bebd-d8b722fc21a6', 'Tincho', 'carga_resultado', '{"games_a": 5, "games_b": 0, "resultado": "5-0", "timestamp": "2026-01-21T22:38:54.391Z", "partido_id": "11ae6883-fb4a-4a00-98af-c055b6e9d7fd", "pareja_nombre": "Tincho - Lau"}', '2026-01-21 22:38:54.644172+00'),
	('44f3b301-aa65-4474-a460-b9e8936b3789', 'ad58a855-fa74-4c2e-825e-32c20f972136', 'f1373f49-9128-43e1-bebd-d8b722fc21a6', 'Tincho', 'carga_resultado', '{"games_a": 5, "games_b": 0, "resultado": "5-0", "timestamp": "2026-01-21T22:51:00.520Z", "partido_id": "11ae6883-fb4a-4a00-98af-c055b6e9d7fd", "pareja_nombre": "Tincho - Lau"}', '2026-01-21 22:51:00.712241+00'),
	('b07de911-2b10-4f2e-b5c7-85d3a322fee4', 'ad58a855-fa74-4c2e-825e-32c20f972136', 'fec26ac2-902f-44d9-80fb-efad078589f4', 'Ari', 'visita', '{"grupo": "Realidad", "companero": "Jenny", "timestamp": "2026-01-21T22:56:49.207Z", "pareja_nombre": "Ari - Jenny"}', '2026-01-21 22:56:49.558313+00'),
	('c84ad28b-ca31-492c-862a-11024726f675', 'ad58a855-fa74-4c2e-825e-32c20f972136', 'fec26ac2-902f-44d9-80fb-efad078589f4', 'Ari', 'carga_resultado', '{"games_a": 4, "games_b": 5, "resultado": "4-5", "timestamp": "2026-01-21T22:57:38.536Z", "partido_id": "17871021-05f1-4b3a-bc14-ea2f88c10330", "pareja_nombre": "Ari - Jenny"}', '2026-01-21 22:57:38.73241+00'),
	('25e685f2-2d6f-4f9b-88a3-e45b5c1c9673', 'ad58a855-fa74-4c2e-825e-32c20f972136', '198a5674-f50b-459d-9971-cffcb4bc09b5', 'Max', 'visita', '{"grupo": "Expectativa", "companero": "Iani", "timestamp": "2026-01-21T23:02:32.201Z", "pareja_nombre": "Max - Iani"}', '2026-01-21 23:02:32.537032+00'),
	('0b1585de-c10f-4a91-84be-7fccd3b187de', 'ad58a855-fa74-4c2e-825e-32c20f972136', '7a1272ce-3421-433a-b4ce-8300daf6e28d', 'Dani', 'visita', '{"grupo": "Expectativa", "companero": "Seba T", "timestamp": "2026-01-21T23:03:24.454Z", "pareja_nombre": "Seba T - Dani"}', '2026-01-21 23:03:24.806458+00'),
	('19367f58-e433-4406-9454-57620dcd5797', 'ad58a855-fa74-4c2e-825e-32c20f972136', '7a1272ce-3421-433a-b4ce-8300daf6e28d', 'Dani', 'carga_resultado', '{"games_a": 4, "games_b": 5, "resultado": "4-5", "timestamp": "2026-01-21T23:04:28.727Z", "partido_id": "b0ff04ec-b1b9-4d3d-992d-94e304d5856c", "pareja_nombre": "Seba T - Dani"}', '2026-01-21 23:04:28.893534+00'),
	('74b53004-9745-41a2-85d0-6613836bb478', 'ad58a855-fa74-4c2e-825e-32c20f972136', '4af2cef0-89ce-474f-85c0-a73c6691d1aa', 'Diego', 'carga_resultado', '{"games_a": 5, "games_b": 0, "resultado": "5-0", "timestamp": "2026-01-21T23:09:13.231Z", "partido_id": "11ae6883-fb4a-4a00-98af-c055b6e9d7fd", "pareja_nombre": "Diego - Jesi"}', '2026-01-21 23:09:13.523786+00'),
	('da72b1f0-d5a0-43e7-a759-a614af15d1a3', 'ad58a855-fa74-4c2e-825e-32c20f972136', '4af2cef0-89ce-474f-85c0-a73c6691d1aa', 'Diego', 'carga_resultado', '{"games_a": 1, "games_b": 5, "resultado": "1-5", "timestamp": "2026-01-21T23:09:30.508Z", "partido_id": "6b6a3f20-4ff8-452f-96f2-9e77d2a7fe16", "pareja_nombre": "Diego - Jesi"}', '2026-01-21 23:09:30.719743+00'),
	('56779ccb-12dd-48c3-87fb-ba5967cae5b9', 'ad58a855-fa74-4c2e-825e-32c20f972136', '2266a177-3c20-48f6-968c-133f7463f428', 'Ani', 'carga_resultado', '{"games_a": 3, "games_b": 5, "resultado": "3-5", "timestamp": "2026-01-21T23:11:05.114Z", "partido_id": "fa94f00f-b3c1-466e-a3af-47e06fde20ce", "pareja_nombre": "Nico - Ani"}', '2026-01-21 23:11:05.378931+00'),
	('b5bd4e00-c089-4736-9c20-31ecf5bb2f61', 'ad58a855-fa74-4c2e-825e-32c20f972136', '9063b50d-8209-44fc-a020-bee3526f9b1d', 'Pau', 'visita', '{"grupo": "Realidad", "companero": "Ger", "timestamp": "2026-01-21T23:29:31.272Z", "pareja_nombre": "Ger - Pau"}', '2026-01-21 23:29:31.385143+00'),
	('83be1681-8377-4721-a11e-1995807e1350', 'ad58a855-fa74-4c2e-825e-32c20f972136', '9063b50d-8209-44fc-a020-bee3526f9b1d', 'Pau', 'carga_resultado', '{"games_a": 4, "games_b": 5, "resultado": "4-5", "timestamp": "2026-01-21T23:30:21.873Z", "partido_id": "17871021-05f1-4b3a-bc14-ea2f88c10330", "pareja_nombre": "Ger - Pau"}', '2026-01-21 23:30:21.910899+00'),
	('d4317ec1-b5f8-41bf-843f-e0ad7845f857', 'ad58a855-fa74-4c2e-825e-32c20f972136', '9063b50d-8209-44fc-a020-bee3526f9b1d', 'Pau', 'carga_resultado', '{"games_a": 5, "games_b": 2, "resultado": "5-2", "timestamp": "2026-01-21T23:30:42.548Z", "partido_id": "742acc22-cbaa-469b-90d5-61cc03caac9b", "pareja_nombre": "Ger - Pau"}', '2026-01-21 23:30:42.587404+00'),
	('a91ea371-d309-45d7-a3a7-c33f58f60a0d', 'ad58a855-fa74-4c2e-825e-32c20f972136', 'f1373f49-9128-43e1-bebd-d8b722fc21a6', 'Tincho', 'carga_resultado', '{"games_a": 2, "games_b": 5, "resultado": "2-5", "timestamp": "2026-01-21T23:33:46.307Z", "partido_id": "14aaa796-134c-431e-88ce-92a5283a57d6", "pareja_nombre": "Tincho - Lau"}', '2026-01-21 23:33:46.557367+00'),
	('140a2ee7-d1ef-4675-acc3-2b5afe14b229', 'ad58a855-fa74-4c2e-825e-32c20f972136', '7a1272ce-3421-433a-b4ce-8300daf6e28d', 'Dani', 'carga_resultado', '{"games_a": 2, "games_b": 5, "resultado": "2-5", "timestamp": "2026-01-21T23:37:20.019Z", "partido_id": "14aaa796-134c-431e-88ce-92a5283a57d6", "pareja_nombre": "Seba T - Dani"}', '2026-01-21 23:37:20.262408+00'),
	('51c5d333-211e-4636-90ff-17c34bef0be6', 'ad58a855-fa74-4c2e-825e-32c20f972136', '22171e29-a328-43c8-9d9d-773949767fa1', 'Alan', 'carga_resultado', '{"games_a": 5, "games_b": 2, "resultado": "5-2", "timestamp": "2026-01-21T23:37:25.106Z", "partido_id": "6c5fa9f4-5cbe-47cc-85ed-06451ee38c0c", "pareja_nombre": "Alan - Tammy"}', '2026-01-21 23:37:25.385267+00'),
	('0f452fde-eea4-4139-a595-5f01be0ec3bc', 'ad58a855-fa74-4c2e-825e-32c20f972136', '2266a177-3c20-48f6-968c-133f7463f428', 'Ani', 'carga_resultado', '{"games_a": 5, "games_b": 2, "resultado": "5-2", "timestamp": "2026-01-21T23:40:09.241Z", "partido_id": "62f7d2ab-f626-4c70-a9e6-bc286bd501ef", "pareja_nombre": "Nico - Ani"}', '2026-01-21 23:40:09.476159+00'),
	('24aee4df-ce0b-4d81-ae7f-794d9592130a', 'ad58a855-fa74-4c2e-825e-32c20f972136', 'fec26ac2-902f-44d9-80fb-efad078589f4', 'Jenny', 'visita', '{"grupo": "Realidad", "companero": "Ari", "timestamp": "2026-01-21T23:47:43.087Z", "pareja_nombre": "Ari - Jenny"}', '2026-01-21 23:47:43.19886+00'),
	('548d711c-273d-4926-b6a9-bb222a3171b4', 'ad58a855-fa74-4c2e-825e-32c20f972136', 'fec26ac2-902f-44d9-80fb-efad078589f4', 'Jenny', 'carga_resultado', '{"games_a": 5, "games_b": 2, "resultado": "5-2", "timestamp": "2026-01-21T23:48:14.139Z", "partido_id": "62f7d2ab-f626-4c70-a9e6-bc286bd501ef", "pareja_nombre": "Ari - Jenny"}', '2026-01-21 23:48:14.069029+00'),
	('19a31156-7d37-43bc-a911-66831a5d3212', 'ad58a855-fa74-4c2e-825e-32c20f972136', '4af2cef0-89ce-474f-85c0-a73c6691d1aa', 'Diego', 'carga_resultado', '{"games_a": 3, "games_b": 5, "resultado": "3-5", "timestamp": "2026-01-22T00:02:22.041Z", "partido_id": "b13f90d5-037e-43cb-8ef7-dbc22de0f1dd", "pareja_nombre": "Diego - Jesi"}', '2026-01-22 00:02:22.360226+00'),
	('daf378d0-b7b8-41ba-9c27-682b1fddb19e', 'ad58a855-fa74-4c2e-825e-32c20f972136', '720b5f4c-b516-475b-8f14-cf5d05dbee6f', 'Nati', 'visita', '{"grupo": "Realidad", "companero": "Pablo", "timestamp": "2026-01-22T00:03:39.762Z", "pareja_nombre": "Pablo - Nati"}', '2026-01-22 00:03:40.02816+00'),
	('06d06abb-3db3-4bc4-9fe7-4903761de8f2', 'ad58a855-fa74-4c2e-825e-32c20f972136', '720b5f4c-b516-475b-8f14-cf5d05dbee6f', 'Nati', 'carga_resultado', '{"games_a": 3, "games_b": 5, "resultado": "3-5", "timestamp": "2026-01-22T00:04:06.724Z", "partido_id": "e78c89d0-1099-4891-b326-a5bd56d2872f", "pareja_nombre": "Pablo - Nati"}', '2026-01-22 00:04:06.894362+00'),
	('1733a46b-2a3d-4547-9f2c-af1056b1ca1a', 'ad58a855-fa74-4c2e-825e-32c20f972136', '720b5f4c-b516-475b-8f14-cf5d05dbee6f', 'Nati', 'carga_resultado', '{"games_a": 3, "games_b": 5, "resultado": "3-5", "timestamp": "2026-01-22T00:04:18.062Z", "partido_id": "fa94f00f-b3c1-466e-a3af-47e06fde20ce", "pareja_nombre": "Pablo - Nati"}', '2026-01-22 00:04:18.247543+00'),
	('19505bfd-7efd-4bea-831c-b4ac40039c2f', 'ad58a855-fa74-4c2e-825e-32c20f972136', '43e9c439-2bec-4cb7-b1bc-9671574beb68', 'Lean', 'visita', '{"grupo": "Realidad", "companero": "Mica", "timestamp": "2026-01-22T00:05:08.054Z", "pareja_nombre": "Lean - Mica"}', '2026-01-22 00:05:08.771854+00'),
	('7f0542f2-839b-491b-b677-9496d1b0ae06', 'ad58a855-fa74-4c2e-825e-32c20f972136', '43e9c439-2bec-4cb7-b1bc-9671574beb68', 'Lean', 'carga_resultado', '{"games_a": 3, "games_b": 5, "resultado": "3-5", "timestamp": "2026-01-22T00:05:32.091Z", "partido_id": "e78c89d0-1099-4891-b326-a5bd56d2872f", "pareja_nombre": "Lean - Mica"}', '2026-01-22 00:05:32.269872+00'),
	('17d3c41b-07b1-45a0-a0b4-f213df7f908c', 'ad58a855-fa74-4c2e-825e-32c20f972136', '43e9c439-2bec-4cb7-b1bc-9671574beb68', 'Lean', 'carga_resultado', '{"games_a": 5, "games_b": 2, "resultado": "5-2", "timestamp": "2026-01-22T00:05:37.743Z", "partido_id": "742acc22-cbaa-469b-90d5-61cc03caac9b", "pareja_nombre": "Lean - Mica"}', '2026-01-22 00:05:37.890932+00'),
	('090586d8-22fa-4697-9f4a-1b0a0f1eb193', 'ad58a855-fa74-4c2e-825e-32c20f972136', '2266a177-3c20-48f6-968c-133f7463f428', 'Ani', 'carga_resultado', '{"games_a": 1, "games_b": 5, "resultado": "1-5", "timestamp": "2026-01-22T00:08:00.967Z", "partido_id": "32e3c331-1bf8-4543-91f5-c0086ea7dce0", "pareja_nombre": "Nico - Ani"}', '2026-01-22 00:08:01.321457+00'),
	('7aed6f72-422d-4dc1-8cfa-30287d986bd7', 'ad58a855-fa74-4c2e-825e-32c20f972136', 'f1373f49-9128-43e1-bebd-d8b722fc21a6', 'Tincho', 'carga_resultado', '{"games_a": 5, "games_b": 2, "resultado": "5-2", "timestamp": "2026-01-22T00:08:21.763Z", "partido_id": "858666fe-bc70-4243-b1da-ed91c8a3cb54", "pareja_nombre": "Tincho - Lau"}', '2026-01-22 00:08:21.93355+00'),
	('489a6e79-0c16-412d-b84c-dbb9ff7228a3', 'ad58a855-fa74-4c2e-825e-32c20f972136', '9063b50d-8209-44fc-a020-bee3526f9b1d', 'Pau', 'carga_resultado', '{"games_a": 5, "games_b": 3, "resultado": "5-3", "timestamp": "2026-01-22T00:19:29.753Z", "partido_id": "32e3c331-1bf8-4543-91f5-c0086ea7dce0", "pareja_nombre": "Ger - Pau"}', '2026-01-22 00:19:29.75009+00'),
	('cf3ff6b1-04da-4c23-80c8-7e73afe3390f', 'ad58a855-fa74-4c2e-825e-32c20f972136', '2266a177-3c20-48f6-968c-133f7463f428', 'Ani', 'carga_resultado', '{"games_a": 1, "games_b": 5, "resultado": "1-5", "timestamp": "2026-01-22T00:33:51.943Z", "partido_id": "32e3c331-1bf8-4543-91f5-c0086ea7dce0", "pareja_nombre": "Nico - Ani"}', '2026-01-22 00:33:52.138871+00'),
	('3ed9375d-39e0-42d5-87d5-877b234c4fa0', 'ad58a855-fa74-4c2e-825e-32c20f972136', '2266a177-3c20-48f6-968c-133f7463f428', 'Ani', 'carga_resultado', '{"games_a": 5, "games_b": 2, "resultado": "5-2", "timestamp": "2026-01-22T00:34:09.584Z", "partido_id": "2a19c57d-8e98-4705-a532-85711160f0b4", "pareja_nombre": "Nico - Ani"}', '2026-01-22 00:34:09.767064+00'),
	('e48b3893-ef54-4031-9eab-43bb1d539daf', 'ad58a855-fa74-4c2e-825e-32c20f972136', '22171e29-a328-43c8-9d9d-773949767fa1', 'Alan', 'carga_resultado', '{"games_a": 5, "games_b": 2, "resultado": "5-2", "timestamp": "2026-01-22T00:35:36.358Z", "partido_id": "858666fe-bc70-4243-b1da-ed91c8a3cb54", "pareja_nombre": "Alan - Tammy"}', '2026-01-22 00:35:36.558747+00'),
	('6a10bf02-1a5b-45b1-acbb-6942fa244d91', 'ad58a855-fa74-4c2e-825e-32c20f972136', '7a1272ce-3421-433a-b4ce-8300daf6e28d', 'Dani', 'carga_resultado', '{"games_a": 4, "games_b": 5, "resultado": "4-5", "timestamp": "2026-01-22T00:35:58.706Z", "partido_id": "cc593cc3-b6dd-4a98-a93a-a595e03133b2", "pareja_nombre": "Seba T - Dani"}', '2026-01-22 00:35:58.97705+00'),
	('ef82a65f-5640-405b-b2c1-497702609172', 'ad58a855-fa74-4c2e-825e-32c20f972136', 'fec26ac2-902f-44d9-80fb-efad078589f4', 'Jenny', 'carga_resultado', '{"games_a": 5, "games_b": 4, "resultado": "5-4", "timestamp": "2026-01-22T00:36:33.814Z", "partido_id": "b7a4d27f-66cc-407d-8ac6-29bde9e42d15", "pareja_nombre": "Ari - Jenny"}', '2026-01-22 00:36:33.72763+00'),
	('81755cba-efd5-43cd-aad5-18ea813d795b', 'ad58a855-fa74-4c2e-825e-32c20f972136', '22171e29-a328-43c8-9d9d-773949767fa1', 'Alan', 'carga_resultado', '{"games_a": 4, "games_b": 5, "resultado": "4-5", "timestamp": "2026-01-22T00:36:57.411Z", "partido_id": "cc593cc3-b6dd-4a98-a93a-a595e03133b2", "pareja_nombre": "Alan - Tammy"}', '2026-01-22 00:36:57.618588+00'),
	('9b2d1da5-aa8c-4956-99f7-427dad6681d3', 'ad58a855-fa74-4c2e-825e-32c20f972136', '22171e29-a328-43c8-9d9d-773949767fa1', 'Alan', 'carga_resultado', '{"games_a": 1, "games_b": 5, "resultado": "1-5", "timestamp": "2026-01-22T00:37:08.043Z", "partido_id": "6b6a3f20-4ff8-452f-96f2-9e77d2a7fe16", "pareja_nombre": "Alan - Tammy"}', '2026-01-22 00:37:08.274992+00'),
	('c7f36ebc-fa4e-4918-8fa7-a3eac082233e', 'ad58a855-fa74-4c2e-825e-32c20f972136', '720b5f4c-b516-475b-8f14-cf5d05dbee6f', 'Nati', 'carga_resultado', '{"games_a": 5, "games_b": 4, "resultado": "5-4", "timestamp": "2026-01-22T00:40:32.018Z", "partido_id": "b7a4d27f-66cc-407d-8ac6-29bde9e42d15", "pareja_nombre": "Pablo - Nati"}', '2026-01-22 00:40:32.320828+00'),
	('59b23d67-9464-4961-b7fb-7eaf9bf9875f', 'ad58a855-fa74-4c2e-825e-32c20f972136', 'f1373f49-9128-43e1-bebd-d8b722fc21a6', 'Tincho', 'carga_resultado', '{"games_a": 4, "games_b": 5, "resultado": "4-5", "timestamp": "2026-01-22T00:57:14.031Z", "partido_id": "01af07bf-6efb-4622-816d-90c152ead0a6", "pareja_nombre": "Tincho - Lau"}', '2026-01-22 00:57:14.761497+00'),
	('1cf67c20-92df-4548-b030-2cc1526f453d', 'ad58a855-fa74-4c2e-825e-32c20f972136', '4af2cef0-89ce-474f-85c0-a73c6691d1aa', 'Diego', 'carga_resultado', '{"games_a": 2, "games_b": 5, "resultado": "2-5", "timestamp": "2026-01-22T01:03:41.425Z", "partido_id": "2d8c7421-2a9a-4202-9ff1-220be79299c3", "pareja_nombre": "Diego - Jesi"}', '2026-01-22 01:03:41.676729+00'),
	('5ecbc759-b92c-4b9d-ac0c-a4435c897734', 'ad58a855-fa74-4c2e-825e-32c20f972136', '7a1272ce-3421-433a-b4ce-8300daf6e28d', 'Dani', 'carga_resultado', '{"games_a": 2, "games_b": 5, "resultado": "2-5", "timestamp": "2026-01-22T01:03:46.857Z", "partido_id": "2d8c7421-2a9a-4202-9ff1-220be79299c3", "pareja_nombre": "Seba T - Dani"}', '2026-01-22 01:03:47.179126+00'),
	('2ac44510-42a5-46a9-9009-4909a8f96ec8', 'ad58a855-fa74-4c2e-825e-32c20f972136', 'fec26ac2-902f-44d9-80fb-efad078589f4', 'Ari', 'visita', '{"grupo": "Realidad", "companero": "Jenny", "timestamp": "2026-01-22T01:16:18.912Z", "pareja_nombre": "Ari - Jenny"}', '2026-01-22 01:16:19.257759+00'),
	('a707b8ad-61cf-45df-b1e3-27b3f5dc8b66', 'ad58a855-fa74-4c2e-825e-32c20f972136', 'fec26ac2-902f-44d9-80fb-efad078589f4', 'Ari', 'carga_resultado', '{"games_a": 5, "games_b": 2, "resultado": "5-2", "timestamp": "2026-01-22T01:16:32.771Z", "partido_id": "3fcba88a-ec17-460a-b2b0-abf319d95957", "pareja_nombre": "Ari - Jenny"}', '2026-01-22 01:16:32.9409+00'),
	('91ef24f7-1119-4a00-a8b3-8701915e755b', 'ad58a855-fa74-4c2e-825e-32c20f972136', 'fec26ac2-902f-44d9-80fb-efad078589f4', 'Ari', 'carga_resultado', '{"games_a": 5, "games_b": 2, "resultado": "5-2", "timestamp": "2026-01-22T02:47:06.799Z", "partido_id": "7869b835-8c25-4452-8fff-9136d45f6248", "pareja_nombre": "Ari - Jenny"}', '2026-01-22 02:47:07.054824+00'),
	('2f516b63-9929-40f9-8089-2e95e006fcd1', 'ad58a855-fa74-4c2e-825e-32c20f972136', 'f1373f49-9128-43e1-bebd-d8b722fc21a6', 'Tincho', 'visita', '{"grupo": "Expectativa", "companero": "Lau", "timestamp": "2026-01-22T04:14:12.359Z", "pareja_nombre": "Tincho - Lau"}', '2026-01-22 04:14:12.572836+00'),
	('64369e76-259e-4d53-b39e-ce5db372934c', 'ad58a855-fa74-4c2e-825e-32c20f972136', '7a1272ce-3421-433a-b4ce-8300daf6e28d', 'Dani', 'carga_resultado', '{"games_a": 2, "games_b": 5, "resultado": "2-5", "timestamp": "2026-01-22T04:14:15.467Z", "partido_id": "635f09d8-ed89-4716-9c0b-0c48be47008d", "pareja_nombre": "Seba T - Dani"}', '2026-01-22 04:14:15.649989+00'),
	('eeb39f6a-2850-4f7e-9f68-0f90ea1a63a8', 'ad58a855-fa74-4c2e-825e-32c20f972136', 'f1373f49-9128-43e1-bebd-d8b722fc21a6', 'Tincho', 'carga_resultado', '{"games_a": 5, "games_b": 3, "resultado": "5-3", "timestamp": "2026-01-22T04:14:28.176Z", "partido_id": "bc507ef8-d441-4e66-a310-b3b2687a1fce", "pareja_nombre": "Tincho - Lau"}', '2026-01-22 04:14:28.31936+00'),
	('c37294de-07e1-4f8c-bbd7-a04f921da21d', 'ad58a855-fa74-4c2e-825e-32c20f972136', '7a1272ce-3421-433a-b4ce-8300daf6e28d', 'Dani', 'carga_resultado', '{"games_a": 4, "games_b": 5, "resultado": "4-5", "timestamp": "2026-01-22T04:15:23.665Z", "partido_id": "b0ff04ec-b1b9-4d3d-992d-94e304d5856c", "pareja_nombre": "Seba T - Dani"}', '2026-01-22 04:15:23.837213+00'),
	('79a15131-6912-47d7-8184-69279494bd69', 'ad58a855-fa74-4c2e-825e-32c20f972136', '2266a177-3c20-48f6-968c-133f7463f428', 'Nico', 'visita', '{"grupo": "Realidad", "companero": "Ani", "timestamp": "2026-01-22T04:16:04.056Z", "pareja_nombre": "Nico - Ani"}', '2026-01-22 04:16:04.199467+00'),
	('901bbb47-b196-4f2c-a0de-478ce7db027d', 'ad58a855-fa74-4c2e-825e-32c20f972136', '2266a177-3c20-48f6-968c-133f7463f428', 'Nico', 'carga_resultado', '{"games_a": 2, "games_b": 5, "resultado": "2-5", "timestamp": "2026-01-22T04:16:19.485Z", "partido_id": "635f09d8-ed89-4716-9c0b-0c48be47008d", "pareja_nombre": "Nico - Ani"}', '2026-01-22 04:16:19.630019+00'),
	('9f908048-8854-41b5-8344-9055c73bb54f', 'ad58a855-fa74-4c2e-825e-32c20f972136', '22171e29-a328-43c8-9d9d-773949767fa1', 'Alan', 'carga_resultado', '{"games_a": 5, "games_b": 2, "resultado": "5-2", "timestamp": "2026-01-22T12:59:51.482Z", "partido_id": "7869b835-8c25-4452-8fff-9136d45f6248", "pareja_nombre": "Alan - Tammy"}', '2026-01-22 12:59:51.697387+00'),
	('123c3900-bf7c-4fad-840d-dd662e70d859', 'ad58a855-fa74-4c2e-825e-32c20f972136', '7a1272ce-3421-433a-b4ce-8300daf6e28d', 'Seba T', 'visita', '{"grupo": "Expectativa", "companero": "Dani", "timestamp": "2026-01-22T13:13:56.199Z", "pareja_nombre": "Seba T - Dani"}', '2026-01-22 13:13:57.144156+00'),
	('43f2f8ac-0e7e-4822-aa3f-b55d4f199dc8', 'ad58a855-fa74-4c2e-825e-32c20f972136', 'f1373f49-9128-43e1-bebd-d8b722fc21a6', 'Tincho', 'visita', '{"grupo": "Expectativa", "companero": "Lau", "timestamp": "2026-01-23T03:55:10.833Z", "pareja_nombre": "Tincho - Lau"}', '2026-01-23 03:55:11.306818+00');


--
-- Data for Name: buckets; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: buckets_analytics; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: buckets_vectors; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: objects; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: prefixes; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: s3_multipart_uploads; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: s3_multipart_uploads_parts; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: vector_indexes; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: supabase_auth_admin
--

SELECT pg_catalog.setval('"auth"."refresh_tokens_id_seq"', 1, false);


--
-- PostgreSQL database dump complete
--

-- \unrestrict kx7UCU79QoX7oKe5iePOMgyhrMNlvNFihs0PL9IkhiwLrIUYUbiyy8oWtEdeBTo

RESET ALL;
