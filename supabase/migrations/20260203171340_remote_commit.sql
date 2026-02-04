


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






CREATE OR REPLACE FUNCTION "public"."sync_estado_quincenal"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.estado = CASE WHEN NEW.pagado THEN 'PAGADO' ELSE 'PENDIENTE' END;
  NEW.quincena_inicio = NEW.fecha_inicio;
  NEW.quincena_fin = NEW.fecha_fin;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_estado_quincenal"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_estado_semanal"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.estado = CASE WHEN NEW.pagado THEN 'PAGADO' ELSE 'PENDIENTE' END;
  NEW.semana_inicio = NEW.fecha_inicio;
  NEW.semana_fin = NEW.fecha_fin;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_estado_semanal"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."adelantos_empleados" (
    "id" bigint NOT NULL,
    "empleado" "text" NOT NULL,
    "fecha_adelanto" "date" NOT NULL,
    "monto" numeric(12,2) NOT NULL,
    "estado" "text" DEFAULT 'Pendiente'::"text",
    "fecha_descuento" "date",
    "observaciones" "text",
    "origen" "text" DEFAULT 'MANUAL'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."adelantos_empleados" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."adelantos_empleados_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."adelantos_empleados_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."adelantos_empleados_id_seq" OWNED BY "public"."adelantos_empleados"."id";



CREATE TABLE IF NOT EXISTS "public"."clientes" (
    "id" bigint NOT NULL,
    "cuit" "text" NOT NULL,
    "razon_social" "text" NOT NULL,
    "email" "text",
    "telefono" "text",
    "direccion" "text",
    "observaciones" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."clientes" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."clientes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."clientes_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."clientes_id_seq" OWNED BY "public"."clientes"."id";



CREATE TABLE IF NOT EXISTS "public"."conceptos" (
    "id" bigint NOT NULL,
    "nombre" "text" NOT NULL,
    "tipo" "text" NOT NULL,
    "frecuencia_pago" "text",
    "descripcion" "text",
    CONSTRAINT "conceptos_frecuencia_pago_check" CHECK (("frecuencia_pago" = ANY (ARRAY['SEMANAL'::"text", 'QUINCENAL'::"text", 'MENSUAL'::"text", 'NINGUNA'::"text"]))),
    CONSTRAINT "conceptos_tipo_check" CHECK (("tipo" = ANY (ARRAY['RENTAS'::"text", 'CAJA'::"text"])))
);


ALTER TABLE "public"."conceptos" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."conceptos_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."conceptos_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."conceptos_id_seq" OWNED BY "public"."conceptos"."id";



CREATE TABLE IF NOT EXISTS "public"."control_efectivo_config" (
    "id" integer NOT NULL,
    "saldo_inicial" numeric(12,2) DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "control_efectivo_config_id_check" CHECK (("id" = 1))
);


ALTER TABLE "public"."control_efectivo_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."control_epagos" (
    "id" bigint NOT NULL,
    "fecha" "date" NOT NULL,
    "monto" numeric(12,2) NOT NULL,
    "observaciones" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."control_epagos" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."control_epagos_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."control_epagos_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."control_epagos_id_seq" OWNED BY "public"."control_epagos"."id";



CREATE TABLE IF NOT EXISTS "public"."control_posnet" (
    "id" bigint NOT NULL,
    "mes" integer NOT NULL,
    "anio" integer NOT NULL,
    "total_rentas" numeric(12,2) DEFAULT 0,
    "total_caja" numeric(12,2) DEFAULT 0,
    "total_general" numeric(12,2) DEFAULT 0,
    "fecha_generacion" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."control_posnet" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."control_posnet_diario" (
    "id" bigint NOT NULL,
    "fecha" "date" NOT NULL,
    "monto_rentas" numeric(12,2) DEFAULT 0,
    "monto_caja" numeric(12,2) DEFAULT 0,
    "total_posnet" numeric(12,2) DEFAULT 0,
    "monto_ingresado_banco" numeric(12,2) DEFAULT 0,
    "diferencia" numeric(12,2) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."control_posnet_diario" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."control_posnet_diario_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."control_posnet_diario_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."control_posnet_diario_id_seq" OWNED BY "public"."control_posnet_diario"."id";



CREATE SEQUENCE IF NOT EXISTS "public"."control_posnet_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."control_posnet_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."control_posnet_id_seq" OWNED BY "public"."control_posnet"."id";



CREATE TABLE IF NOT EXISTS "public"."control_veps" (
    "id" bigint NOT NULL,
    "fecha" "date" NOT NULL,
    "monto" numeric(12,2) NOT NULL,
    "observaciones" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."control_veps" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."control_veps_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."control_veps_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."control_veps_id_seq" OWNED BY "public"."control_veps"."id";



CREATE TABLE IF NOT EXISTS "public"."controles_quincenales" (
    "id" bigint NOT NULL,
    "concepto_id" bigint NOT NULL,
    "quincena" "text" NOT NULL,
    "mes" integer NOT NULL,
    "anio" integer NOT NULL,
    "fecha_inicio" "date" NOT NULL,
    "fecha_fin" "date" NOT NULL,
    "total_recaudado" numeric(12,2) DEFAULT 0,
    "fecha_pago_programada" "date" NOT NULL,
    "pagado" boolean DEFAULT false,
    "fecha_pago_real" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "estado" character varying(20) DEFAULT 'PENDIENTE'::character varying,
    "concepto_nombre" character varying(255),
    "concepto_tipo" character varying(10),
    "quincena_inicio" "date",
    "quincena_fin" "date",
    CONSTRAINT "controles_quincenales_quincena_check" CHECK (("quincena" = ANY (ARRAY['PRIMERA'::"text", 'SEGUNDA'::"text"])))
);


ALTER TABLE "public"."controles_quincenales" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."controles_quincenales_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."controles_quincenales_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."controles_quincenales_id_seq" OWNED BY "public"."controles_quincenales"."id";



CREATE TABLE IF NOT EXISTS "public"."controles_semanales" (
    "id" bigint NOT NULL,
    "concepto_id" bigint NOT NULL,
    "fecha_inicio" "date" NOT NULL,
    "fecha_fin" "date" NOT NULL,
    "total_recaudado" numeric(12,2) DEFAULT 0,
    "fecha_pago_programada" "date" NOT NULL,
    "pagado" boolean DEFAULT false,
    "fecha_pago_real" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "estado" character varying(20) DEFAULT 'PENDIENTE'::character varying,
    "concepto_nombre" character varying(255),
    "concepto_tipo" character varying(10),
    "semana_inicio" "date",
    "semana_fin" "date"
);


ALTER TABLE "public"."controles_semanales" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."controles_semanales_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."controles_semanales_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."controles_semanales_id_seq" OWNED BY "public"."controles_semanales"."id";



CREATE TABLE IF NOT EXISTS "public"."cuentas_corrientes" (
    "id" bigint NOT NULL,
    "nombre" "text" NOT NULL,
    "tipo" "text" NOT NULL,
    "saldo_actual" numeric(12,2) DEFAULT 0,
    CONSTRAINT "cuentas_corrientes_tipo_check" CHECK (("tipo" = ANY (ARRAY['RENTAS'::"text", 'CAJA'::"text", 'GASTOS_REGISTRO'::"text", 'GASTOS_PERSONALES'::"text", 'ADELANTOS'::"text"])))
);


ALTER TABLE "public"."cuentas_corrientes" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."cuentas_corrientes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."cuentas_corrientes_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."cuentas_corrientes_id_seq" OWNED BY "public"."cuentas_corrientes"."id";



CREATE TABLE IF NOT EXISTS "public"."depositos" (
    "id" bigint NOT NULL,
    "monto_original" numeric(12,2) NOT NULL,
    "saldo_actual" numeric(12,2) NOT NULL,
    "fecha_ingreso" "date" NOT NULL,
    "fecha_uso" "date",
    "fecha_devolucion" "date",
    "estado" "text" DEFAULT 'PENDIENTE'::"text" NOT NULL,
    "tipo_uso" "text",
    "descripcion_uso" "text",
    "monto_devuelto" numeric(12,2) DEFAULT 0,
    "titular" "text" NOT NULL,
    "observaciones" "text",
    "cuenta_id" bigint,
    "movimiento_origen_id" bigint,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "cliente_id" bigint,
    CONSTRAINT "depositos_estado_check" CHECK (("estado" = ANY (ARRAY['PENDIENTE'::"text", 'LIQUIDADO'::"text", 'A_FAVOR'::"text", 'A_CUENTA'::"text", 'DEVUELTO'::"text"]))),
    CONSTRAINT "depositos_tipo_uso_check" CHECK (("tipo_uso" = ANY (ARRAY['CAJA'::"text", 'RENTAS'::"text", 'A_CUENTA'::"text", 'DEVUELTO'::"text"])))
);


ALTER TABLE "public"."depositos" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."depositos_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."depositos_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."depositos_id_seq" OWNED BY "public"."depositos"."id";



CREATE TABLE IF NOT EXISTS "public"."formularios" (
    "id" bigint NOT NULL,
    "numero" "text" NOT NULL,
    "descripcion" "text",
    "monto" numeric(12,2) NOT NULL,
    "fecha_compra" "date" NOT NULL,
    "proveedor" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."formularios" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."formularios_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."formularios_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."formularios_id_seq" OWNED BY "public"."formularios"."id";



CREATE TABLE IF NOT EXISTS "public"."formularios_vencimientos" (
    "id" bigint NOT NULL,
    "formulario_id" bigint NOT NULL,
    "numero_vencimiento" integer NOT NULL,
    "fecha_vencimiento" "date" NOT NULL,
    "monto" numeric(12,2) NOT NULL,
    "estado" "text" DEFAULT 'PENDIENTE'::"text",
    "fecha_pago" "date",
    "gasto_registral_id" bigint,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "formularios_vencimientos_estado_check" CHECK (("estado" = ANY (ARRAY['PENDIENTE'::"text", 'PAGADO'::"text", 'VENCIDO'::"text"]))),
    CONSTRAINT "formularios_vencimientos_numero_vencimiento_check" CHECK (("numero_vencimiento" = ANY (ARRAY[1, 2, 3])))
);


ALTER TABLE "public"."formularios_vencimientos" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."formularios_vencimientos_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."formularios_vencimientos_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."formularios_vencimientos_id_seq" OWNED BY "public"."formularios_vencimientos"."id";



CREATE TABLE IF NOT EXISTS "public"."gastos_mios" (
    "id" bigint NOT NULL,
    "fecha" "date" NOT NULL,
    "concepto" "text" NOT NULL,
    "monto" numeric(12,2) NOT NULL,
    "categoria" "text" NOT NULL,
    "tipo" "text" NOT NULL,
    "observaciones" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "gastos_mios_categoria_check" CHECK (("categoria" = ANY (ARRAY['GASTO'::"text", 'INGRESO'::"text", 'AHORRO'::"text"]))),
    CONSTRAINT "gastos_mios_tipo_check" CHECK (("tipo" = ANY (ARRAY['FIJO'::"text", 'VARIABLE'::"text"])))
);


ALTER TABLE "public"."gastos_mios" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."gastos_mios_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."gastos_mios_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."gastos_mios_id_seq" OWNED BY "public"."gastos_mios"."id";



CREATE TABLE IF NOT EXISTS "public"."gastos_personales" (
    "id" bigint NOT NULL,
    "fecha" "date" NOT NULL,
    "concepto" "text" NOT NULL,
    "monto" numeric(12,2) NOT NULL,
    "observaciones" "text",
    "estado" "text" DEFAULT 'Pagado'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "gastos_personales_concepto_check" CHECK (("concepto" = ANY (ARRAY['Gaspar'::"text", 'Nacion'::"text", 'Efectivo'::"text", 'Patagonia'::"text", 'Credicoop'::"text"]))),
    CONSTRAINT "gastos_personales_estado_check" CHECK (("estado" = ANY (ARRAY['Pagado'::"text", 'Pendiente'::"text"])))
);


ALTER TABLE "public"."gastos_personales" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."gastos_personales_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."gastos_personales_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."gastos_personales_id_seq" OWNED BY "public"."gastos_personales"."id";



CREATE TABLE IF NOT EXISTS "public"."gastos_registrales" (
    "id" bigint NOT NULL,
    "fecha" "date" NOT NULL,
    "concepto" "text" NOT NULL,
    "monto" numeric(12,2) NOT NULL,
    "observaciones" "text",
    "origen" "text" DEFAULT 'MANUAL'::"text",
    "estado" "text" DEFAULT 'Pagado'::"text",
    "boleta1" numeric(12,2) DEFAULT 0,
    "boleta2" numeric(12,2) DEFAULT 0,
    "boleta3" numeric(12,2) DEFAULT 0,
    "boleta4" numeric(12,2) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."gastos_registrales" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."gastos_registrales_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."gastos_registrales_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."gastos_registrales_id_seq" OWNED BY "public"."gastos_registrales"."id";



CREATE TABLE IF NOT EXISTS "public"."movimientos" (
    "id" bigint NOT NULL,
    "fecha" "date" NOT NULL,
    "tipo" "text" NOT NULL,
    "cuit" "text" NOT NULL,
    "concepto_id" bigint NOT NULL,
    "monto" numeric(12,2) NOT NULL,
    "observaciones" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "movimientos_tipo_check" CHECK (("tipo" = ANY (ARRAY['RENTAS'::"text", 'CAJA'::"text"])))
);


ALTER TABLE "public"."movimientos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."movimientos_cc" (
    "id" bigint NOT NULL,
    "cuenta_id" bigint NOT NULL,
    "fecha" "date" NOT NULL,
    "tipo_movimiento" "text" NOT NULL,
    "concepto" "text" NOT NULL,
    "monto" numeric(12,2) NOT NULL,
    "saldo_resultante" numeric(12,2) NOT NULL,
    "movimiento_origen_id" bigint,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "movimientos_cc_tipo_movimiento_check" CHECK (("tipo_movimiento" = ANY (ARRAY['INGRESO'::"text", 'EGRESO'::"text"])))
);


ALTER TABLE "public"."movimientos_cc" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."movimientos_cc_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."movimientos_cc_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."movimientos_cc_id_seq" OWNED BY "public"."movimientos_cc"."id";



CREATE TABLE IF NOT EXISTS "public"."movimientos_efectivo" (
    "id" bigint NOT NULL,
    "fecha" "date" NOT NULL,
    "tipo" "text" NOT NULL,
    "concepto" "text" NOT NULL,
    "monto" numeric(12,2) NOT NULL,
    "cuenta_id" bigint,
    "observaciones" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "movimientos_efectivo_tipo_check" CHECK (("tipo" = ANY (ARRAY['INGRESO'::"text", 'GASTO'::"text", 'DEPOSITO'::"text"])))
);


ALTER TABLE "public"."movimientos_efectivo" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."movimientos_efectivo_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."movimientos_efectivo_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."movimientos_efectivo_id_seq" OWNED BY "public"."movimientos_efectivo"."id";



CREATE SEQUENCE IF NOT EXISTS "public"."movimientos_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."movimientos_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."movimientos_id_seq" OWNED BY "public"."movimientos"."id";



ALTER TABLE ONLY "public"."adelantos_empleados" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."adelantos_empleados_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."clientes" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."clientes_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."conceptos" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."conceptos_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."control_epagos" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."control_epagos_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."control_posnet" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."control_posnet_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."control_posnet_diario" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."control_posnet_diario_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."control_veps" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."control_veps_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."controles_quincenales" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."controles_quincenales_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."controles_semanales" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."controles_semanales_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."cuentas_corrientes" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."cuentas_corrientes_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."depositos" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."depositos_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."formularios" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."formularios_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."formularios_vencimientos" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."formularios_vencimientos_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."gastos_mios" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."gastos_mios_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."gastos_personales" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."gastos_personales_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."gastos_registrales" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."gastos_registrales_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."movimientos" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."movimientos_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."movimientos_cc" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."movimientos_cc_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."movimientos_efectivo" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."movimientos_efectivo_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."adelantos_empleados"
    ADD CONSTRAINT "adelantos_empleados_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_cuit_key" UNIQUE ("cuit");



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conceptos"
    ADD CONSTRAINT "conceptos_nombre_key" UNIQUE ("nombre");



ALTER TABLE ONLY "public"."conceptos"
    ADD CONSTRAINT "conceptos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."control_efectivo_config"
    ADD CONSTRAINT "control_efectivo_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."control_epagos"
    ADD CONSTRAINT "control_epagos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."control_posnet_diario"
    ADD CONSTRAINT "control_posnet_diario_fecha_key" UNIQUE ("fecha");



ALTER TABLE ONLY "public"."control_posnet_diario"
    ADD CONSTRAINT "control_posnet_diario_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."control_posnet"
    ADD CONSTRAINT "control_posnet_mes_anio_key" UNIQUE ("mes", "anio");



ALTER TABLE ONLY "public"."control_posnet"
    ADD CONSTRAINT "control_posnet_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."control_veps"
    ADD CONSTRAINT "control_veps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."controles_quincenales"
    ADD CONSTRAINT "controles_quincenales_concepto_id_mes_anio_quincena_key" UNIQUE ("concepto_id", "mes", "anio", "quincena");



ALTER TABLE ONLY "public"."controles_quincenales"
    ADD CONSTRAINT "controles_quincenales_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."controles_semanales"
    ADD CONSTRAINT "controles_semanales_concepto_id_fecha_inicio_fecha_fin_key" UNIQUE ("concepto_id", "fecha_inicio", "fecha_fin");



ALTER TABLE ONLY "public"."controles_semanales"
    ADD CONSTRAINT "controles_semanales_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cuentas_corrientes"
    ADD CONSTRAINT "cuentas_corrientes_nombre_key" UNIQUE ("nombre");



ALTER TABLE ONLY "public"."cuentas_corrientes"
    ADD CONSTRAINT "cuentas_corrientes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."depositos"
    ADD CONSTRAINT "depositos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."formularios"
    ADD CONSTRAINT "formularios_numero_key" UNIQUE ("numero");



ALTER TABLE ONLY "public"."formularios"
    ADD CONSTRAINT "formularios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."formularios_vencimientos"
    ADD CONSTRAINT "formularios_vencimientos_formulario_id_numero_vencimiento_key" UNIQUE ("formulario_id", "numero_vencimiento");



ALTER TABLE ONLY "public"."formularios_vencimientos"
    ADD CONSTRAINT "formularios_vencimientos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gastos_mios"
    ADD CONSTRAINT "gastos_mios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gastos_personales"
    ADD CONSTRAINT "gastos_personales_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gastos_registrales"
    ADD CONSTRAINT "gastos_registrales_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."movimientos_cc"
    ADD CONSTRAINT "movimientos_cc_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."movimientos_efectivo"
    ADD CONSTRAINT "movimientos_efectivo_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."movimientos"
    ADD CONSTRAINT "movimientos_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_adelantos_empleado" ON "public"."adelantos_empleados" USING "btree" ("empleado");



CREATE INDEX "idx_adelantos_estado" ON "public"."adelantos_empleados" USING "btree" ("estado");



CREATE INDEX "idx_clientes_cuit" ON "public"."clientes" USING "btree" ("cuit");



CREATE INDEX "idx_control_epagos_fecha" ON "public"."control_epagos" USING "btree" ("fecha");



CREATE INDEX "idx_control_veps_fecha" ON "public"."control_veps" USING "btree" ("fecha");



CREATE INDEX "idx_controles_quincenales_estado" ON "public"."controles_quincenales" USING "btree" ("estado");



CREATE INDEX "idx_controles_quincenales_fecha_pago" ON "public"."controles_quincenales" USING "btree" ("fecha_pago_programada");



CREATE INDEX "idx_controles_semanales_estado" ON "public"."controles_semanales" USING "btree" ("estado");



CREATE INDEX "idx_controles_semanales_fecha_pago" ON "public"."controles_semanales" USING "btree" ("fecha_pago_programada");



CREATE INDEX "idx_depositos_cuenta" ON "public"."depositos" USING "btree" ("cuenta_id");



CREATE INDEX "idx_depositos_estado" ON "public"."depositos" USING "btree" ("estado");



CREATE INDEX "idx_depositos_fecha_ingreso" ON "public"."depositos" USING "btree" ("fecha_ingreso");



CREATE INDEX "idx_formularios_vencimientos_estado" ON "public"."formularios_vencimientos" USING "btree" ("estado");



CREATE INDEX "idx_formularios_vencimientos_fecha" ON "public"."formularios_vencimientos" USING "btree" ("fecha_vencimiento");



CREATE INDEX "idx_formularios_vencimientos_formulario" ON "public"."formularios_vencimientos" USING "btree" ("formulario_id");



CREATE INDEX "idx_gastos_mios_categoria" ON "public"."gastos_mios" USING "btree" ("categoria");



CREATE INDEX "idx_gastos_mios_concepto" ON "public"."gastos_mios" USING "btree" ("concepto");



CREATE INDEX "idx_gastos_mios_fecha" ON "public"."gastos_mios" USING "btree" ("fecha");



CREATE INDEX "idx_gastos_mios_tipo" ON "public"."gastos_mios" USING "btree" ("tipo");



CREATE INDEX "idx_gastos_personales_concepto" ON "public"."gastos_personales" USING "btree" ("concepto");



CREATE INDEX "idx_gastos_personales_estado" ON "public"."gastos_personales" USING "btree" ("estado");



CREATE INDEX "idx_gastos_personales_fecha" ON "public"."gastos_personales" USING "btree" ("fecha");



CREATE INDEX "idx_gastos_registrales_concepto" ON "public"."gastos_registrales" USING "btree" ("concepto");



CREATE INDEX "idx_gastos_registrales_estado" ON "public"."gastos_registrales" USING "btree" ("estado");



CREATE INDEX "idx_gastos_registrales_fecha" ON "public"."gastos_registrales" USING "btree" ("fecha");



CREATE INDEX "idx_movimientos_cc_cuenta" ON "public"."movimientos_cc" USING "btree" ("cuenta_id");



CREATE INDEX "idx_movimientos_cc_fecha" ON "public"."movimientos_cc" USING "btree" ("fecha");



CREATE INDEX "idx_movimientos_concepto" ON "public"."movimientos" USING "btree" ("concepto_id");



CREATE INDEX "idx_movimientos_efectivo_fecha" ON "public"."movimientos_efectivo" USING "btree" ("fecha");



CREATE INDEX "idx_movimientos_efectivo_tipo" ON "public"."movimientos_efectivo" USING "btree" ("tipo");



CREATE INDEX "idx_movimientos_fecha" ON "public"."movimientos" USING "btree" ("fecha");



CREATE INDEX "idx_movimientos_tipo" ON "public"."movimientos" USING "btree" ("tipo");



CREATE OR REPLACE TRIGGER "trg_sync_estado_quincenal" BEFORE INSERT OR UPDATE ON "public"."controles_quincenales" FOR EACH ROW EXECUTE FUNCTION "public"."sync_estado_quincenal"();



CREATE OR REPLACE TRIGGER "trg_sync_estado_semanal" BEFORE INSERT OR UPDATE ON "public"."controles_semanales" FOR EACH ROW EXECUTE FUNCTION "public"."sync_estado_semanal"();



ALTER TABLE ONLY "public"."controles_quincenales"
    ADD CONSTRAINT "controles_quincenales_concepto_id_fkey" FOREIGN KEY ("concepto_id") REFERENCES "public"."conceptos"("id");



ALTER TABLE ONLY "public"."controles_semanales"
    ADD CONSTRAINT "controles_semanales_concepto_id_fkey" FOREIGN KEY ("concepto_id") REFERENCES "public"."conceptos"("id");



ALTER TABLE ONLY "public"."depositos"
    ADD CONSTRAINT "depositos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id");



ALTER TABLE ONLY "public"."depositos"
    ADD CONSTRAINT "depositos_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "public"."cuentas_corrientes"("id");



ALTER TABLE ONLY "public"."depositos"
    ADD CONSTRAINT "depositos_movimiento_origen_id_fkey" FOREIGN KEY ("movimiento_origen_id") REFERENCES "public"."movimientos"("id");



ALTER TABLE ONLY "public"."formularios_vencimientos"
    ADD CONSTRAINT "formularios_vencimientos_formulario_id_fkey" FOREIGN KEY ("formulario_id") REFERENCES "public"."formularios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."formularios_vencimientos"
    ADD CONSTRAINT "formularios_vencimientos_gasto_registral_id_fkey" FOREIGN KEY ("gasto_registral_id") REFERENCES "public"."gastos_registrales"("id");



ALTER TABLE ONLY "public"."movimientos_cc"
    ADD CONSTRAINT "movimientos_cc_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "public"."cuentas_corrientes"("id");



ALTER TABLE ONLY "public"."movimientos_cc"
    ADD CONSTRAINT "movimientos_cc_movimiento_origen_id_fkey" FOREIGN KEY ("movimiento_origen_id") REFERENCES "public"."movimientos"("id");



ALTER TABLE ONLY "public"."movimientos"
    ADD CONSTRAINT "movimientos_concepto_id_fkey" FOREIGN KEY ("concepto_id") REFERENCES "public"."conceptos"("id");



ALTER TABLE ONLY "public"."movimientos_efectivo"
    ADD CONSTRAINT "movimientos_efectivo_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "public"."cuentas_corrientes"("id");



CREATE POLICY "Usuarios autenticados pueden actualizar adelantos_empleados" ON "public"."adelantos_empleados" FOR UPDATE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden actualizar clientes" ON "public"."clientes" FOR UPDATE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden actualizar conceptos" ON "public"."conceptos" FOR UPDATE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden actualizar control_efectivo_config" ON "public"."control_efectivo_config" FOR UPDATE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden actualizar control_epagos" ON "public"."control_epagos" FOR UPDATE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden actualizar control_posnet" ON "public"."control_posnet" FOR UPDATE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden actualizar control_posnet_diario" ON "public"."control_posnet_diario" FOR UPDATE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden actualizar control_veps" ON "public"."control_veps" FOR UPDATE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden actualizar controles_quincenales" ON "public"."controles_quincenales" FOR UPDATE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden actualizar controles_semanales" ON "public"."controles_semanales" FOR UPDATE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden actualizar cuentas_corrientes" ON "public"."cuentas_corrientes" FOR UPDATE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden actualizar depositos" ON "public"."depositos" FOR UPDATE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden actualizar formularios" ON "public"."formularios" FOR UPDATE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden actualizar formularios_vencimiento" ON "public"."formularios_vencimientos" FOR UPDATE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden actualizar gastos_mios" ON "public"."gastos_mios" FOR UPDATE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden actualizar gastos_personales" ON "public"."gastos_personales" FOR UPDATE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden actualizar gastos_registrales" ON "public"."gastos_registrales" FOR UPDATE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden actualizar movimientos" ON "public"."movimientos" FOR UPDATE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden actualizar movimientos_cc" ON "public"."movimientos_cc" FOR UPDATE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden actualizar movimientos_efectivo" ON "public"."movimientos_efectivo" FOR UPDATE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden eliminar adelantos_empleados" ON "public"."adelantos_empleados" FOR DELETE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden eliminar clientes" ON "public"."clientes" FOR DELETE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden eliminar conceptos" ON "public"."conceptos" FOR DELETE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden eliminar control_efectivo_config" ON "public"."control_efectivo_config" FOR DELETE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden eliminar control_epagos" ON "public"."control_epagos" FOR DELETE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden eliminar control_posnet" ON "public"."control_posnet" FOR DELETE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden eliminar control_posnet_diario" ON "public"."control_posnet_diario" FOR DELETE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden eliminar control_veps" ON "public"."control_veps" FOR DELETE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden eliminar controles_quincenales" ON "public"."controles_quincenales" FOR DELETE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden eliminar controles_semanales" ON "public"."controles_semanales" FOR DELETE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden eliminar cuentas_corrientes" ON "public"."cuentas_corrientes" FOR DELETE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden eliminar depositos" ON "public"."depositos" FOR DELETE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden eliminar formularios" ON "public"."formularios" FOR DELETE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden eliminar formularios_vencimientos" ON "public"."formularios_vencimientos" FOR DELETE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden eliminar gastos_mios" ON "public"."gastos_mios" FOR DELETE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden eliminar gastos_personales" ON "public"."gastos_personales" FOR DELETE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden eliminar gastos_registrales" ON "public"."gastos_registrales" FOR DELETE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden eliminar movimientos" ON "public"."movimientos" FOR DELETE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden eliminar movimientos_cc" ON "public"."movimientos_cc" FOR DELETE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden eliminar movimientos_efectivo" ON "public"."movimientos_efectivo" FOR DELETE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden insertar adelantos_empleados" ON "public"."adelantos_empleados" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden insertar clientes" ON "public"."clientes" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden insertar conceptos" ON "public"."conceptos" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden insertar control_efectivo_config" ON "public"."control_efectivo_config" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden insertar control_epagos" ON "public"."control_epagos" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden insertar control_posnet" ON "public"."control_posnet" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden insertar control_posnet_diario" ON "public"."control_posnet_diario" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden insertar control_veps" ON "public"."control_veps" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden insertar controles_quincenales" ON "public"."controles_quincenales" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden insertar controles_semanales" ON "public"."controles_semanales" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden insertar cuentas_corrientes" ON "public"."cuentas_corrientes" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden insertar depositos" ON "public"."depositos" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden insertar formularios" ON "public"."formularios" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden insertar formularios_vencimientos" ON "public"."formularios_vencimientos" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden insertar gastos_mios" ON "public"."gastos_mios" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden insertar gastos_personales" ON "public"."gastos_personales" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden insertar gastos_registrales" ON "public"."gastos_registrales" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden insertar movimientos" ON "public"."movimientos" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden insertar movimientos_cc" ON "public"."movimientos_cc" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden insertar movimientos_efectivo" ON "public"."movimientos_efectivo" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden ver adelantos_empleados" ON "public"."adelantos_empleados" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden ver clientes" ON "public"."clientes" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden ver conceptos" ON "public"."conceptos" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden ver control_efectivo_config" ON "public"."control_efectivo_config" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden ver control_epagos" ON "public"."control_epagos" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden ver control_posnet" ON "public"."control_posnet" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden ver control_posnet_diario" ON "public"."control_posnet_diario" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden ver control_veps" ON "public"."control_veps" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden ver controles_quincenales" ON "public"."controles_quincenales" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden ver controles_semanales" ON "public"."controles_semanales" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden ver cuentas_corrientes" ON "public"."cuentas_corrientes" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden ver depositos" ON "public"."depositos" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden ver formularios" ON "public"."formularios" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden ver formularios_vencimientos" ON "public"."formularios_vencimientos" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden ver gastos_mios" ON "public"."gastos_mios" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden ver gastos_personales" ON "public"."gastos_personales" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden ver gastos_registrales" ON "public"."gastos_registrales" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden ver movimientos" ON "public"."movimientos" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden ver movimientos_cc" ON "public"."movimientos_cc" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Usuarios autenticados pueden ver movimientos_efectivo" ON "public"."movimientos_efectivo" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



ALTER TABLE "public"."adelantos_empleados" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clientes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conceptos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."control_efectivo_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."control_epagos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."control_posnet" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."control_posnet_diario" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."control_veps" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."controles_quincenales" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."controles_semanales" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cuentas_corrientes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."depositos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."formularios" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."formularios_vencimientos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gastos_mios" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gastos_personales" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gastos_registrales" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."movimientos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."movimientos_cc" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."movimientos_efectivo" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."sync_estado_quincenal"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_estado_quincenal"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_estado_quincenal"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_estado_semanal"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_estado_semanal"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_estado_semanal"() TO "service_role";


















GRANT ALL ON TABLE "public"."adelantos_empleados" TO "anon";
GRANT ALL ON TABLE "public"."adelantos_empleados" TO "authenticated";
GRANT ALL ON TABLE "public"."adelantos_empleados" TO "service_role";



GRANT ALL ON SEQUENCE "public"."adelantos_empleados_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."adelantos_empleados_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."adelantos_empleados_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."clientes" TO "anon";
GRANT ALL ON TABLE "public"."clientes" TO "authenticated";
GRANT ALL ON TABLE "public"."clientes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."clientes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."clientes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."clientes_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."conceptos" TO "anon";
GRANT ALL ON TABLE "public"."conceptos" TO "authenticated";
GRANT ALL ON TABLE "public"."conceptos" TO "service_role";



GRANT ALL ON SEQUENCE "public"."conceptos_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."conceptos_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."conceptos_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."control_efectivo_config" TO "anon";
GRANT ALL ON TABLE "public"."control_efectivo_config" TO "authenticated";
GRANT ALL ON TABLE "public"."control_efectivo_config" TO "service_role";



GRANT ALL ON TABLE "public"."control_epagos" TO "anon";
GRANT ALL ON TABLE "public"."control_epagos" TO "authenticated";
GRANT ALL ON TABLE "public"."control_epagos" TO "service_role";



GRANT ALL ON SEQUENCE "public"."control_epagos_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."control_epagos_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."control_epagos_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."control_posnet" TO "anon";
GRANT ALL ON TABLE "public"."control_posnet" TO "authenticated";
GRANT ALL ON TABLE "public"."control_posnet" TO "service_role";



GRANT ALL ON TABLE "public"."control_posnet_diario" TO "anon";
GRANT ALL ON TABLE "public"."control_posnet_diario" TO "authenticated";
GRANT ALL ON TABLE "public"."control_posnet_diario" TO "service_role";



GRANT ALL ON SEQUENCE "public"."control_posnet_diario_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."control_posnet_diario_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."control_posnet_diario_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."control_posnet_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."control_posnet_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."control_posnet_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."control_veps" TO "anon";
GRANT ALL ON TABLE "public"."control_veps" TO "authenticated";
GRANT ALL ON TABLE "public"."control_veps" TO "service_role";



GRANT ALL ON SEQUENCE "public"."control_veps_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."control_veps_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."control_veps_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."controles_quincenales" TO "anon";
GRANT ALL ON TABLE "public"."controles_quincenales" TO "authenticated";
GRANT ALL ON TABLE "public"."controles_quincenales" TO "service_role";



GRANT ALL ON SEQUENCE "public"."controles_quincenales_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."controles_quincenales_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."controles_quincenales_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."controles_semanales" TO "anon";
GRANT ALL ON TABLE "public"."controles_semanales" TO "authenticated";
GRANT ALL ON TABLE "public"."controles_semanales" TO "service_role";



GRANT ALL ON SEQUENCE "public"."controles_semanales_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."controles_semanales_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."controles_semanales_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."cuentas_corrientes" TO "anon";
GRANT ALL ON TABLE "public"."cuentas_corrientes" TO "authenticated";
GRANT ALL ON TABLE "public"."cuentas_corrientes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."cuentas_corrientes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."cuentas_corrientes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."cuentas_corrientes_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."depositos" TO "anon";
GRANT ALL ON TABLE "public"."depositos" TO "authenticated";
GRANT ALL ON TABLE "public"."depositos" TO "service_role";



GRANT ALL ON SEQUENCE "public"."depositos_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."depositos_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."depositos_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."formularios" TO "anon";
GRANT ALL ON TABLE "public"."formularios" TO "authenticated";
GRANT ALL ON TABLE "public"."formularios" TO "service_role";



GRANT ALL ON SEQUENCE "public"."formularios_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."formularios_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."formularios_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."formularios_vencimientos" TO "anon";
GRANT ALL ON TABLE "public"."formularios_vencimientos" TO "authenticated";
GRANT ALL ON TABLE "public"."formularios_vencimientos" TO "service_role";



GRANT ALL ON SEQUENCE "public"."formularios_vencimientos_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."formularios_vencimientos_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."formularios_vencimientos_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."gastos_mios" TO "anon";
GRANT ALL ON TABLE "public"."gastos_mios" TO "authenticated";
GRANT ALL ON TABLE "public"."gastos_mios" TO "service_role";



GRANT ALL ON SEQUENCE "public"."gastos_mios_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."gastos_mios_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."gastos_mios_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."gastos_personales" TO "anon";
GRANT ALL ON TABLE "public"."gastos_personales" TO "authenticated";
GRANT ALL ON TABLE "public"."gastos_personales" TO "service_role";



GRANT ALL ON SEQUENCE "public"."gastos_personales_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."gastos_personales_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."gastos_personales_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."gastos_registrales" TO "anon";
GRANT ALL ON TABLE "public"."gastos_registrales" TO "authenticated";
GRANT ALL ON TABLE "public"."gastos_registrales" TO "service_role";



GRANT ALL ON SEQUENCE "public"."gastos_registrales_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."gastos_registrales_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."gastos_registrales_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."movimientos" TO "anon";
GRANT ALL ON TABLE "public"."movimientos" TO "authenticated";
GRANT ALL ON TABLE "public"."movimientos" TO "service_role";



GRANT ALL ON TABLE "public"."movimientos_cc" TO "anon";
GRANT ALL ON TABLE "public"."movimientos_cc" TO "authenticated";
GRANT ALL ON TABLE "public"."movimientos_cc" TO "service_role";



GRANT ALL ON SEQUENCE "public"."movimientos_cc_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."movimientos_cc_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."movimientos_cc_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."movimientos_efectivo" TO "anon";
GRANT ALL ON TABLE "public"."movimientos_efectivo" TO "authenticated";
GRANT ALL ON TABLE "public"."movimientos_efectivo" TO "service_role";



GRANT ALL ON SEQUENCE "public"."movimientos_efectivo_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."movimientos_efectivo_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."movimientos_efectivo_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."movimientos_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."movimientos_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."movimientos_id_seq" TO "service_role";









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































