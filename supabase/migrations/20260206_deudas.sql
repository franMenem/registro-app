-- ============================================================================
-- Feature: Deudas (Debt tracking)
-- Fecha: 2026-02-06
-- Tablas: deudas (parent) + deudas_pagos (child payments)
-- Soporta CUOTAS (cuotas fijas) y LIBRE (pagos variables)
-- ============================================================================

-- ============================================================================
-- Tabla: deudas
-- ============================================================================
CREATE TABLE IF NOT EXISTS "public"."deudas" (
    "id" BIGSERIAL PRIMARY KEY,
    "concepto" TEXT NOT NULL,
    "acreedor" TEXT NOT NULL,
    "monto_total" NUMERIC(12,2) NOT NULL,
    "tipo_pago" TEXT NOT NULL DEFAULT 'LIBRE',
    "cantidad_cuotas" INTEGER,
    "monto_cuota" NUMERIC(12,2),
    "fecha_inicio" DATE NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "observaciones" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT now(),
    "updated_at" TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT "deudas_monto_total_positive" CHECK (monto_total > 0),
    CONSTRAINT "deudas_tipo_pago_check" CHECK (tipo_pago IN ('CUOTAS', 'LIBRE')),
    CONSTRAINT "deudas_estado_check" CHECK (estado IN ('PENDIENTE', 'EN_CURSO', 'PAGADA')),
    CONSTRAINT "deudas_cuotas_consistency" CHECK (
        (tipo_pago = 'CUOTAS' AND cantidad_cuotas IS NOT NULL AND cantidad_cuotas > 0)
        OR
        (tipo_pago = 'LIBRE' AND cantidad_cuotas IS NULL)
    )
);

ALTER TABLE "public"."deudas" OWNER TO "postgres";

CREATE INDEX "idx_deudas_estado" ON "public"."deudas" USING btree ("estado");
CREATE INDEX "idx_deudas_acreedor" ON "public"."deudas" USING btree ("acreedor");
CREATE INDEX "idx_deudas_fecha_inicio" ON "public"."deudas" USING btree ("fecha_inicio");

-- ============================================================================
-- Tabla: deudas_pagos
-- ============================================================================
CREATE TABLE IF NOT EXISTS "public"."deudas_pagos" (
    "id" BIGSERIAL PRIMARY KEY,
    "deuda_id" BIGINT NOT NULL REFERENCES "public"."deudas"("id") ON DELETE CASCADE,
    "fecha" DATE NOT NULL,
    "monto" NUMERIC(12,2) NOT NULL,
    "numero_cuota" INTEGER,
    "observaciones" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT "deudas_pagos_monto_positive" CHECK (monto > 0)
);

ALTER TABLE "public"."deudas_pagos" OWNER TO "postgres";

CREATE INDEX "idx_deudas_pagos_deuda_id" ON "public"."deudas_pagos" USING btree ("deuda_id");
CREATE INDEX "idx_deudas_pagos_fecha" ON "public"."deudas_pagos" USING btree ("fecha");

-- ============================================================================
-- RLS
-- ============================================================================
ALTER TABLE "public"."deudas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."deudas_pagos" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deudas_all" ON "public"."deudas" FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "deudas_pagos_all" ON "public"."deudas_pagos" FOR ALL USING (auth.uid() IS NOT NULL);

-- ============================================================================
-- Grants
-- ============================================================================
GRANT ALL ON TABLE "public"."deudas" TO "anon";
GRANT ALL ON TABLE "public"."deudas" TO "authenticated";
GRANT ALL ON TABLE "public"."deudas" TO "service_role";

GRANT ALL ON SEQUENCE "public"."deudas_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."deudas_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."deudas_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."deudas_pagos" TO "anon";
GRANT ALL ON TABLE "public"."deudas_pagos" TO "authenticated";
GRANT ALL ON TABLE "public"."deudas_pagos" TO "service_role";

GRANT ALL ON SEQUENCE "public"."deudas_pagos_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."deudas_pagos_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."deudas_pagos_id_seq" TO "service_role";
