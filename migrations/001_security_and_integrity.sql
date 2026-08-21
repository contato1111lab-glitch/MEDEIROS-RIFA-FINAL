-- =====================================================================
--  MEDEIROS PREMIAÇÕES — Migração de segurança e integridade
--  Rodar UMA VEZ no SQL Editor do Supabase (roda como service_role).
--
--  Esta migração é idempotente: pode ser executada novamente sem
--  efeitos colaterais.
--
--  O QUE ELA RESOLVE
--  -----------------
--  1. A senha de super admin estava em texto puro em `app_config`, e essa
--     tabela era legível com a chave anon (que vai no bundle público do
--     site). Qualquer visitante conseguia ler a senha e usá-la no header
--     `x-master-password` para virar super admin.
--  2. TODAS as 14 tabelas estavam abertas para leitura anônima, incluindo
--     `profiles` (CPF, telefone, e-mail, endereço, coluna `password`) e
--     `purchases` (dados de pagamento).
--  3. Rifas existiam com `total_numbers` preenchido mas com zero linhas em
--     `raffle_ticket_pool`, o que fazia toda compra falhar na reserva.
--
--  ORDEM RECOMENDADA
--  -----------------
--  Antes de rodar: definir SUPER_ADMIN_PASSWORD_HASH nas variáveis de
--  ambiente da Vercel (a etapa 1 apaga a senha do banco, então sem essa
--  variável ninguém consegue entrar como super admin).
-- =====================================================================


-- =====================================================================
-- ETAPA 1 — Remover segredos em texto puro de app_config
-- =====================================================================
-- A senha mestra passa a viver apenas na variável de ambiente
-- SUPER_ADMIN_PASSWORD_HASH (hash bcrypt), lida por api/_lib/auth.ts.

DELETE FROM public.app_config
WHERE key IN ('master_password', 'super_admin_password');


-- =====================================================================
-- ETAPA 2 — Ligar Row Level Security em todas as tabelas
-- =====================================================================
-- Com RLS ligada e sem política, o padrão passa a ser "nega tudo" para
-- anon/authenticated. O service_role (usado pela API) ignora RLS, então o
-- backend continua funcionando normalmente.

ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raffles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raffle_ticket_pool ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.winners            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.winning_tickets    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ranking_history    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ghost_audit_log    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_audit_log   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scratch_cards      ENABLE ROW LEVEL SECURITY;


-- =====================================================================
-- ETAPA 3 — Remover políticas permissivas antigas
-- =====================================================================
-- Apaga qualquer política pré-existente nessas tabelas para que o
-- resultado final seja exatamente o definido abaixo, sem sobras de
-- políticas "USING (true)" criadas em testes anteriores.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN (
              'profiles','app_config','purchases','raffles','raffle_ticket_pool',
              'winners','winning_tickets','banners','support_messages',
              'ranking_history','audit_logs','ghost_audit_log',
              'ticket_audit_log','scratch_cards'
          )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
                       r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;


-- =====================================================================
-- ETAPA 4 — Conteúdo público (vitrine do site)
-- =====================================================================
-- Estas tabelas alimentam a Home, a página da rifa, banners e ganhadores.
-- Leitura liberada; escrita continua exclusiva do backend (service_role).

CREATE POLICY "public_read_raffles"
    ON public.raffles FOR SELECT TO anon, authenticated
    USING (true);

CREATE POLICY "public_read_banners"
    ON public.banners FOR SELECT TO anon, authenticated
    USING (true);

CREATE POLICY "public_read_winners"
    ON public.winners FOR SELECT TO anon, authenticated
    USING (true);

CREATE POLICY "public_read_ranking_history"
    ON public.ranking_history FOR SELECT TO anon, authenticated
    USING (true);

-- Só bilhetes premiados já divulgados aparecem publicamente.
CREATE POLICY "public_read_active_winning_tickets"
    ON public.winning_tickets FOR SELECT TO anon, authenticated
    USING (is_active = true);

-- O pool de cotas é lido para calcular quantas cotas já foram vendidas.
-- As colunas sensíveis são restringidas por GRANT na etapa 6.
CREATE POLICY "public_read_ticket_pool"
    ON public.raffle_ticket_pool FOR SELECT TO anon, authenticated
    USING (true);


-- =====================================================================
-- ETAPA 5 — app_config: apenas as chaves realmente públicas
-- =====================================================================
-- O site precisa de título, descrição, favicon e imagem de compartilhamento.
-- Tudo que não começa com "site_" (senhas, credenciais do gateway,
-- configuração de ghost mode) fica invisível para o público.

CREATE POLICY "public_read_site_config_only"
    ON public.app_config FOR SELECT TO anon, authenticated
    USING (key LIKE 'site\_%');


-- =====================================================================
-- ETAPA 6 — Dados pessoais: bloqueio por linha E por coluna
-- =====================================================================
-- RLS controla LINHAS, não colunas. Alguns componentes públicos precisam
-- do nome do comprador (notificação "Fulano acabou de comprar", ranking,
-- lista de ganhadores), então em vez de liberar a tabela inteira usamos
-- GRANT por coluna: o público enxerga só id e nome, nunca CPF, telefone,
-- e-mail, endereço ou a coluna `password`.

REVOKE ALL ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, full_name) ON public.profiles TO anon, authenticated;

CREATE POLICY "public_read_profile_name_only"
    ON public.profiles FOR SELECT TO anon, authenticated
    USING (true);

-- Compras: o público vê o suficiente para o feed de "vendas recentes" e o
-- acompanhamento do pedido, mas nunca o código PIX, os identificadores do
-- gateway ou dados do pagador.
REVOKE ALL ON public.purchases FROM anon, authenticated;
GRANT SELECT (id, raffle_id, user_id, quantity, status, created_at)
    ON public.purchases TO anon, authenticated;

CREATE POLICY "public_read_purchase_summary"
    ON public.purchases FOR SELECT TO anon, authenticated
    USING (true);


-- =====================================================================
-- ETAPA 7 — Suporte: só escrita, nunca leitura
-- =====================================================================
-- Um visitante pode enviar uma mensagem, mas não pode ler as mensagens
-- dos outros. A leitura acontece pelo painel admin, via service_role.

REVOKE ALL ON public.support_messages FROM anon, authenticated;
GRANT INSERT (name, email, phone, subject, message, created_at)
    ON public.support_messages TO anon, authenticated;

CREATE POLICY "public_insert_support_message"
    ON public.support_messages FOR INSERT TO anon, authenticated
    WITH CHECK (true);


-- =====================================================================
-- ETAPA 8 — Tabelas exclusivamente internas
-- =====================================================================
-- Sem política = sem acesso para anon/authenticated. Apenas o backend
-- (service_role) enxerga. Os GRANTs são revogados também, para que nem a
-- estrutura fique acessível.

REVOKE ALL ON public.audit_logs       FROM anon, authenticated;
REVOKE ALL ON public.ghost_audit_log  FROM anon, authenticated;
REVOKE ALL ON public.ticket_audit_log FROM anon, authenticated;
REVOKE ALL ON public.scratch_cards    FROM anon, authenticated;
REVOKE ALL ON public.app_config       FROM anon, authenticated;
GRANT SELECT (key, value) ON public.app_config TO anon, authenticated;


-- =====================================================================
-- ETAPA 9 — Reconstruir os pools de cotas que ficaram vazios
-- =====================================================================
-- Diagnóstico em 19/08/2026: 3 de 5 rifas tinham total_numbers definido
-- (100, 992 e 10) e ZERO linhas em raffle_ticket_pool. A vitrine mostrava
-- as cotas como disponíveis porque esse número vem de raffles.total_numbers,
-- mas a reserva falhava porque não existiam cotas de verdade — é a origem
-- do erro "Not enough tickets available" / "Alta concorrência".
--
-- Só rifas SEM NENHUMA cota vendida ou reservada são reconstruídas, para
-- não destruir o histórico de quem já comprou.

DO $$
DECLARE
    r RECORD;
    v_sold INT;
    v_existing INT;
BEGIN
    FOR r IN SELECT id, name, total_numbers FROM public.raffles LOOP
        SELECT COUNT(*) INTO v_existing
        FROM public.raffle_ticket_pool WHERE raffle_id = r.id;

        SELECT COUNT(*) INTO v_sold
        FROM public.raffle_ticket_pool
        WHERE raffle_id = r.id AND status IN ('PAID', 'RESERVED');

        IF v_existing <> r.total_numbers THEN
            IF v_sold > 0 THEN
                RAISE WARNING
                    'Rifa "%" (%) tem % cotas no pool, esperado %, e % já vendidas/reservadas. NÃO foi reconstruída — revise manualmente.',
                    r.name, r.id, v_existing, r.total_numbers, v_sold;
            ELSE
                RAISE NOTICE 'Reconstruindo pool da rifa "%" (%): % -> % cotas.',
                    r.name, r.id, v_existing, r.total_numbers;
                DELETE FROM public.raffle_ticket_pool WHERE raffle_id = r.id;
                PERFORM public.rpc_create_raffle_pool(r.id);
            END IF;
        END IF;
    END LOOP;
END $$;


-- =====================================================================
-- ETAPA 10 — Corrigir a checagem de disponibilidade da reserva
-- =====================================================================
-- A versão anterior calculava as cotas disponíveis como
-- `raffles.total_numbers - vendidas`, ou seja, confiava no número
-- declarado na rifa em vez de contar as cotas que existem de fato.
-- Quando o pool estava incompleto, a primeira checagem passava e a função
-- só falhava depois, ao tentar travar as linhas, devolvendo
-- "Alta concorrência. Tente novamente." — uma mensagem que não tem
-- nenhuma relação com a causa real.
--
-- Agora a disponibilidade vem do próprio pool, e um pool inconsistente
-- gera uma mensagem específica.

-- A funcao publicada hoje devolve um UUID puro (o purchase_id), enquanto a
-- versao abaixo devolve JSONB. O Postgres nao permite trocar o tipo de
-- retorno com CREATE OR REPLACE (erro "cannot change return type of
-- existing function"), entao ela precisa ser removida antes.
--
-- Esse contrato divergente e a causa do bug de compra: o backend lia
-- rpcResult.purchase_id, mas uma string nao tem essa propriedade, entao a
-- compra era reportada como falha DEPOIS de as cotas ja terem sido
-- reservadas -- prendendo estoque a cada tentativa.
DROP FUNCTION IF EXISTS public.rpc_reserve_tickets(UUID, UUID, INT, NUMERIC, NUMERIC);

CREATE OR REPLACE FUNCTION public.rpc_reserve_tickets(
    p_raffle_id UUID,
    p_user_id UUID,
    p_qty INT,
    p_total_value NUMERIC,
    p_ticket_price NUMERIC
) RETURNS JSONB AS $$
DECLARE
    v_raffle RECORD;
    v_purchase_id UUID;
    v_available INT;
    v_pool_total INT;
    v_sold_count INT;
    v_is_in_margin BOOLEAN := FALSE;
    v_expiration_minutes INT := 15;
    v_tickets_to_reserve UUID[];
BEGIN
    IF p_qty <= 0 THEN
        RAISE EXCEPTION 'Quantidade inválida.';
    END IF;

    SELECT * INTO v_raffle FROM public.raffles WHERE id = p_raffle_id FOR SHARE;
    IF v_raffle.id IS NULL THEN
        RAISE EXCEPTION 'Rifa não encontrada.';
    END IF;
    IF v_raffle.status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'Rifa inativa.';
    END IF;

    -- Disponibilidade contada no pool real, não em raffles.total_numbers.
    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'AVAILABLE'),
        COUNT(*) FILTER (WHERE status IN ('PAID', 'RESERVED'))
    INTO v_pool_total, v_available, v_sold_count
    FROM public.raffle_ticket_pool
    WHERE raffle_id = p_raffle_id;

    IF v_pool_total = 0 THEN
        RAISE EXCEPTION
            'As cotas desta rifa ainda não foram geradas. Avise o administrador.';
    END IF;

    IF v_pool_total <> v_raffle.total_numbers THEN
        RAISE WARNING 'Rifa % tem % cotas no pool mas total_numbers = %.',
            p_raffle_id, v_pool_total, v_raffle.total_numbers;
    END IF;

    IF p_qty > v_available THEN
        RAISE EXCEPTION 'Quantidade indisponível. Restam apenas % cotas.', v_available;
    END IF;

    IF v_raffle.security_margin_percent > 0 AND v_pool_total > 0 THEN
        IF (v_sold_count::FLOAT / v_pool_total::FLOAT) * 100
           >= (100 - v_raffle.security_margin_percent) THEN
            v_is_in_margin := TRUE;
            v_expiration_minutes := 5;
        END IF;
    END IF;

    SELECT array_agg(id) INTO v_tickets_to_reserve
    FROM (
        SELECT id FROM public.raffle_ticket_pool
        WHERE raffle_id = p_raffle_id AND status = 'AVAILABLE'
        ORDER BY random_order
        LIMIT p_qty
        FOR UPDATE SKIP LOCKED
    ) t;

    IF v_tickets_to_reserve IS NULL
       OR array_length(v_tickets_to_reserve, 1) < p_qty THEN
        RAISE EXCEPTION 'Alta concorrência no momento. Tente novamente.';
    END IF;

    INSERT INTO public.purchases (
        user_id, raffle_id, quantity, total_value, ticket_price,
        status, payment_status, created_at
    ) VALUES (
        p_user_id, p_raffle_id, p_qty, p_total_value, p_ticket_price,
        'pending', 'pending', NOW()
    ) RETURNING id INTO v_purchase_id;

    UPDATE public.raffle_ticket_pool
    SET status = 'RESERVED',
        purchase_id = v_purchase_id,
        owner_user_id = p_user_id,
        reserved_at = NOW()
    WHERE id = ANY(v_tickets_to_reserve);

    RETURN jsonb_build_object(
        'success', true,
        'purchase_id', v_purchase_id,
        'is_in_margin', v_is_in_margin,
        'expiration_minutes', v_expiration_minutes,
        'remaining_tickets', v_available - p_qty
    );
END;
$$ LANGUAGE plpgsql;


-- =====================================================================
-- ETAPA 11 — Liberar reservas expiradas
-- =====================================================================
-- Diagnóstico: 16 cotas estavam presas em RESERVED sem nenhuma compra
-- paga. Reserva que não virou pagamento precisa voltar para o estoque,
-- senão a rifa "esgota" sem ter vendido.

UPDATE public.raffle_ticket_pool
SET status = 'AVAILABLE',
    purchase_id = NULL,
    owner_user_id = NULL,
    reserved_at = NULL
WHERE status = 'RESERVED'
  AND reserved_at < NOW() - INTERVAL '30 minutes'
  AND purchase_id IN (
      SELECT id FROM public.purchases
      WHERE payment_status <> 'paid' AND status <> 'paid'
  );

UPDATE public.purchases
SET status = 'cancelled', payment_status = 'cancelled'
WHERE payment_status = 'pending'
  AND status = 'pending'
  AND created_at < NOW() - INTERVAL '30 minutes';


-- =====================================================================
-- ETAPA 12 — Coluna que faltava para o "Modo Sombra"
-- =====================================================================
-- O SuperAdminPanel liga/desliga o modo sombra por rifa, mas a coluna
-- correspondente nunca foi criada, então a ação falhava.

ALTER TABLE public.raffles
    ADD COLUMN IF NOT EXISTS is_hidden_from_admin BOOLEAN NOT NULL DEFAULT FALSE;


-- =====================================================================
-- ETAPA 13 — Políticas do Storage (bucket public_images)
-- =====================================================================
-- Hoje qualquer visitante com a chave anon consegue APAGAR e SOBRESCREVER
-- arquivos do bucket. Testado: um DELETE anônimo respondeu
-- {"message":"Successfully deleted"}. Ou seja, dava para apagar as imagens
-- do site inteiro de fora.
--
-- O que cada papel precisa de fato:
--   - visitante (anon): LER as imagens públicas e ENVIAR novas (o upload do
--     admin acontece no navegador, com a chave anon).
--   - backend (service_role): tudo, inclusive apagar. A exclusão de imagem
--     passou a ser feita no servidor, junto com a exclusão da rifa/banner.
--
-- Então anon perde UPDATE e DELETE, e mantém SELECT e INSERT.

DO $
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT policyname FROM pg_policies
        WHERE schemaname = 'storage' AND tablename = 'objects'
          AND policyname LIKE '%public_images%'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
    END LOOP;
END $;

CREATE POLICY "public_images_read"
    ON storage.objects FOR SELECT TO anon, authenticated
    USING (bucket_id = 'public_images');

CREATE POLICY "public_images_upload"
    ON storage.objects FOR INSERT TO anon, authenticated
    WITH CHECK (bucket_id = 'public_images');

-- Sem política de UPDATE nem de DELETE para anon/authenticated: só o
-- service_role (que ignora RLS) altera ou remove arquivos.


-- =====================================================================
-- VERIFICAÇÃO — rode depois para conferir o resultado
-- =====================================================================
-- Nenhuma linha deve voltar sem RLS:
--
--   SELECT tablename, rowsecurity FROM pg_tables
--   WHERE schemaname='public' AND rowsecurity = false;
--
-- Pool x total declarado (a coluna diff precisa ser 0 em todas):
--
--   SELECT r.name, r.total_numbers,
--          COUNT(p.id) AS pool,
--          r.total_numbers - COUNT(p.id) AS diff
--   FROM public.raffles r
--   LEFT JOIN public.raffle_ticket_pool p ON p.raffle_id = r.id
--   GROUP BY r.id, r.name, r.total_numbers;
--
-- Confirmar que a senha saiu do banco (deve voltar vazio):
--
--   SELECT key FROM public.app_config
--   WHERE key IN ('master_password','super_admin_password');
-- =====================================================================
