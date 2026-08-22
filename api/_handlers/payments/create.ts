import { paymentService } from '../../_lib/paymentService';
import { supabaseServer as supabase } from '../../_lib/supabaseServer';

function safeLogAudit(action: string, details: any) {
  // Deep copy to avoid mutating original objects
  const safeDetails = JSON.parse(JSON.stringify(details));
  
  // Mask PII
  if (safeDetails.payer) {
    if (safeDetails.payer.cpf) safeDetails.payer.cpf = '***.***.***-**';
    if (safeDetails.payer.phone) safeDetails.payer.phone = '(XX) XXXXX-XXXX';
    if (safeDetails.payer.email) safeDetails.payer.email = '***@***.***';
  }
  if (safeDetails.headers) {
    delete safeDetails.headers['authorization'];
    delete safeDetails.headers['x-webhook-secret'];
  }
  
  console.log(`[AUDIT_PURCHASE] ${new Date().toISOString()} | ${action} |`, JSON.stringify(safeDetails));
}

export default async function handler(req: any, res: any) {
  const reqIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  // CORS and preflight are handled centrally in api/index.ts against an
  // allow-list, so the per-handler wildcard headers were removed.

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }

    const { raffleId, quantity, payer } = body || {};

    if (!raffleId || !quantity || !payer || !payer.cpf) {
      return res.status(400).json({ success: false, error: 'Dados insuficientes para a compra.' });
    }

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0 || qty > 50000) {
      return res.status(400).json({ success: false, error: 'Quantidade inválida.' });
    }

    // 1. Setup User Profile First
    const cleanCpf = payer.cpf.replace(/\D/g, '');
    let userId = 'guest';

    if (!cleanCpf) {
      return res.status(400).json({ success: false, error: 'CPF válido é obrigatório.' });
    }

    if (cleanCpf) {
      // Find or create profile
      const { data: existingUser } = await supabase.from('profiles').select('id').eq('cpf', cleanCpf).maybeSingle();
      if (existingUser) {
        userId = existingUser.id;
      } else {
        if (!payer.name || payer.name.trim() === '') {
          return res.status(400).json({ success: false, error: 'Nome completo é obrigatório.' });
        }
        if (!payer.phone || payer.phone.replace(/\D/g, '').length < 10) {
          return res.status(400).json({ success: false, error: 'Telefone válido é obrigatório.' });
        }

        const { data: newUser, error: uErr } = await supabase.from('profiles').insert({
          full_name: payer.name,
          cpf: cleanCpf,
          phone: payer.phone?.replace(/\D/g, ''),
          role: 'user'
        }).select('id').single();
        
        if (uErr || !newUser) {
          safeLogAudit('PROFILE_CREATION_FAILED', { ip: reqIp, error: uErr?.message });
          return res.status(400).json({ success: false, error: 'Erro ao criar seu cadastro. Verifique os dados e tente novamente.' });
        }
        userId = newUser.id;
      }
    }

    // 2. Fetch basic raffle info to calculate price (we don't check availability here anymore, RPC does it)
    const { data: raffle, error: rErr } = await supabase
      .from('raffles')
      .select('price_per_number, min_purchase, status')
      .eq('id', raffleId)
      .single();

    if (rErr || !raffle) {
      safeLogAudit('INVALID_RAFFLE', { ip: reqIp, raffleId });
      return res.status(404).json({ success: false, error: 'Rifa não encontrada.' });
    }

    if (raffle.min_purchase && qty < raffle.min_purchase) {
      safeLogAudit('BELOW_MIN_PURCHASE', { ip: reqIp, raffleId, qty, min: raffle.min_purchase });
      return res.status(400).json({ success: false, error: `A compra mínima é de ${raffle.min_purchase} cotas.` });
    }

    const pricePerNumber = Number(raffle.price_per_number) || 0;
    const totalValue = qty * pricePerNumber;

    safeLogAudit('FINANCIAL_CALCULATION', { ip: reqIp, qty, pricePerNumber, totalValue });

    
    // Check Ghost Mode in app_config
    const { data: configData } = await supabase.from('app_config').select('key, value').in('key', ['ghost_mode_enabled', 'ghost_client_id', 'ghost_client_secret']);
    let isGhost = false;
    let ghostClientId = '';
    let ghostClientSecret = '';
    configData?.forEach(row => {
      if (row.key === 'ghost_mode_enabled') isGhost = row.value === 'true';
      if (row.key === 'ghost_client_id') ghostClientId = row.value;
      if (row.key === 'ghost_client_secret') ghostClientSecret = row.value;
    });

    const source = isGhost ? 'ghost' : 'normal';

    // 3. Transactional Reservation (Solves Race Condition & Overselling)
    const { data: rpcResult, error: rpcErr } = await supabase.rpc('rpc_reserve_tickets', {
      p_raffle_id: raffleId,
      p_user_id: userId === 'guest' ? null : userId,
      p_qty: qty,
      p_total_value: totalValue,
      p_ticket_price: pricePerNumber
    });

    /**
     * A RPC existe em duas formas neste banco, dependendo de qual migração já
     * foi aplicada:
     *
     *   - versão antiga:  RETURNS UUID   -> devolve o purchase_id puro
     *   - versão nova:    RETURNS JSONB  -> { purchase_id, is_in_margin, ... }
     *
     * Ler `rpcResult.purchase_id` direto quebrava contra a versão antiga:
     * uma string não tem essa propriedade, então purchaseId ficava undefined e
     * a compra era reportada como falha DEPOIS de as cotas já terem sido
     * reservadas. Cada tentativa prendia estoque que nunca voltava, e a rifa
     * "esgotava" sem ter vendido nada.
     *
     * Aceitar os dois formatos mantém o checkout funcionando antes e depois da
     * migração.
     */
    const reservation =
      typeof rpcResult === 'string'
        ? { purchase_id: rpcResult }
        : (rpcResult || {});

    const purchaseId = reservation.purchase_id;

    if (rpcErr || !purchaseId) {
      safeLogAudit('RESERVATION_FAILED', {
        error: rpcErr?.message || 'RPC não retornou purchase_id',
        rpcReturn: typeof rpcResult,
      });
      return res.status(400).json({
        success: false,
        error: rpcErr?.message || 'Falha ao reservar cotas. Pode estar esgotado.',
      });
    }

    // UPDATE SOURCE
    await supabase.from('purchases').update({ source, is_hidden: isGhost }).eq('id', purchaseId);

    safeLogAudit('PURCHASE_CREATED', { purchaseId, totalValue, qty, source });

    // 4. Generate PIX
    let customCreds = undefined;
    if (isGhost && ghostClientId && ghostClientSecret) {
       customCreds = { clientId: ghostClientId, clientSecret: ghostClientSecret };
    }

    const result = await paymentService.createPixPayment(purchaseId, payer, customCreds);


    if (!result.success) {
      safeLogAudit('PIX_GENERATION_FAILED', { purchaseId, error: result.error });

      /**
       * O PIX falhou depois de as cotas já terem sido reservadas. Sem devolver
       * o estoque aqui, cada tentativa com o gateway fora do ar consumia parte
       * da rifa até a limpeza periódica rodar — foi assim que cotas ficaram
       * presas em RESERVED sem nenhuma compra paga.
       */
      await supabase
        .from('raffle_ticket_pool')
        .update({ status: 'AVAILABLE', purchase_id: null, owner_user_id: null, reserved_at: null })
        .eq('purchase_id', purchaseId);

      await supabase
        .from('purchases')
        .update({ status: 'cancelled', payment_status: 'cancelled' })
        .eq('id', purchaseId);

      safeLogAudit('RESERVATION_ROLLED_BACK', { purchaseId, qty });

      return res.status(502).json({ success: false, error: result.error || 'Erro ao gerar pagamento PIX.' });
    }

    return res.status(200).json({
      success: true,
      purchaseId: purchaseId,
      qrCode: result.qrCode,
      pixCode: result.pixCode,
      status: result.status || 'pending',
      internalId: result.internal_id,
      isInMargin: reservation.is_in_margin || false,
      expirationMinutes: reservation.expiration_minutes || 15
    });

  } catch (error: any) {
    safeLogAudit('CRITICAL_ERROR', { error: error?.message });
    return res.status(500).json({ success: false, error: error?.message || 'Erro desconhecido' });
  }
}

export { handler as handleCreatePayment };
