-- =====================================================================
-- CORREÇÃO DO BUG DOS BILHETES PREMIADOS BLOQUEADOS
-- =====================================================================

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
    -- AGORA: subtraindo bilhetes premiados que estão com is_active = false
    SELECT
        COUNT(*),
        COUNT(*) FILTER (
            WHERE status = 'AVAILABLE' 
            AND NOT EXISTS (
                SELECT 1 
                FROM public.winning_tickets wt
                WHERE wt.raffle_id = p_raffle_id
                  AND wt.ticket_number = public.raffle_ticket_pool.ticket_number
                  AND wt.is_active = false
            )
        ),
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
        WHERE raffle_id = p_raffle_id 
          AND status = 'AVAILABLE'
          AND NOT EXISTS (
              SELECT 1 
              FROM public.winning_tickets wt
              WHERE wt.raffle_id = p_raffle_id
                AND wt.ticket_number = public.raffle_ticket_pool.ticket_number
                AND wt.is_active = false
          )
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
