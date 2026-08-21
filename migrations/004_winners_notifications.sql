-- Controle de Visualização Única do Cliente
ALTER TABLE public.winners 
ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ DEFAULT NULL;

-- Status de Entrega da Premiação (Admin)
ALTER TABLE public.winners 
ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(20) DEFAULT 'PENDING';

-- Índice para otimizar a busca de prêmios não lidos pelo cliente logado
CREATE INDEX IF NOT EXISTS idx_winners_unnotified 
ON public.winners(user_id) 
WHERE notified_at IS NULL;
