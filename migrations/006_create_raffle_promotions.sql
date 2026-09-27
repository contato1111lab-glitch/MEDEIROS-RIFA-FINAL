-- =====================================================================
--  MEDEIROS PREMIAÇÕES — Migração do Motor de Promoções & Cota em Dobro
--  Arquivo: 006_create_raffle_promotions.sql
-- =====================================================================

-- 1. Criar Tabela de Promoções de Rifa
CREATE TABLE IF NOT EXISTS public.raffle_promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raffle_id UUID NOT NULL REFERENCES public.raffles(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('DOUBLE', 'BUNDLE')),
    title VARCHAR(255) NULL,
    trigger_amount NUMERIC(10,2) NULL,
    multiplier INTEGER NULL,
    bundle_price NUMERIC(10,2) NULL,
    bundle_quantity INTEGER NULL,
    starts_at TIMESTAMPTZ NULL,
    ends_at TIMESTAMPTZ NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_double_promo CHECK (type <> 'DOUBLE' OR (trigger_amount > 0 AND multiplier >= 2)),
    CONSTRAINT chk_bundle_promo CHECK (type <> 'BUNDLE' OR (bundle_price > 0 AND bundle_quantity > 0)),
    CONSTRAINT chk_date_range CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);

-- Index para buscas rápidas por rifa
CREATE INDEX IF NOT EXISTS idx_raffle_promotions_raffle_id ON public.raffle_promotions(raffle_id);

-- 2. Habilitar RLS e Leitura Pública
ALTER TABLE public.raffle_promotions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'raffle_promotions' 
          AND policyname = 'public_read_raffle_promotions'
    ) THEN
        CREATE POLICY "public_read_raffle_promotions"
            ON public.raffle_promotions FOR SELECT TO anon, authenticated
            USING (true);
    END IF;
END $$;

-- 3. Adicionar Colunas de Snapshot de Promoção na Tabela purchases
ALTER TABLE public.purchases 
    ADD COLUMN IF NOT EXISTS promotion_id UUID NULL REFERENCES public.raffle_promotions(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS base_quantity INTEGER NULL,
    ADD COLUMN IF NOT EXISTS awarded_quantity INTEGER NULL;

-- 4. Notificar PostgREST para Recarregar o Schema
NOTIFY pgrst, 'reload schema';

