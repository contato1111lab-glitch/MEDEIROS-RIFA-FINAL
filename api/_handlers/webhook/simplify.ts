import { Request, Response } from 'express';
import { raffleService } from '../../_lib/raffleService';
import { supabaseServer as supabase } from '../../_lib/supabaseServer';
import { paymentService } from '../../_lib/paymentService';
import crypto from 'crypto';

function safeLogAudit(action: string, details: any) {
  let safeDetails: any;
  try {
    safeDetails = JSON.parse(JSON.stringify(details ?? {}));
  } catch {
    safeDetails = { note: 'unserializable details' };
  }

  // Never log raw headers: they carry the webhook secret and bearer tokens.
  delete safeDetails.headers;

  if (safeDetails.payload?.payer) {
    if (safeDetails.payload.payer.cpf) safeDetails.payload.payer.cpf = '***.***.***-**';
    if (safeDetails.payload.payer.phone) safeDetails.payload.payer.phone = '(XX) XXXXX-XXXX';
    if (safeDetails.payload.payer.email) safeDetails.payload.payer.email = '***@***.***';
  }

  console.log(`[AUDIT_WEBHOOK] ${new Date().toISOString()} | ${action} |`, JSON.stringify(safeDetails));
}

function secretsMatch(provided: unknown, expected: string): boolean {
  if (typeof provided !== 'string' || provided.length === 0) return false;
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export default async function handleSimplifyWebhook(req: Request, res: Response) {
  const reqIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  try {
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    /**
     * Authentication.
     *
     * This previously ran only when WEBHOOK_SECRET happened to be set, so a
     * deployment without that variable accepted payment notifications from
     * anyone. It now fails closed.
     */
    const expectedSecret = process.env.WEBHOOK_SECRET;
    if (!expectedSecret) {
      console.error('[WEBHOOK] WEBHOOK_SECRET is not configured; rejecting webhook.');
      return res.status(503).json({ success: false, message: 'Webhook not configured' });
    }

    const providedSecret =
      req.headers['x-webhook-secret'] ||
      req.query.token ||
      (req.headers.authorization || '').replace('Bearer ', '');

    const signature = req.headers['x-signature'] || req.headers['x-simplify-signature'];

    let isValid = secretsMatch(providedSecret, expectedSecret);

    if (!isValid && typeof signature === 'string' && typeof req.body === 'string') {
      const hash = crypto.createHmac('sha256', expectedSecret).update(req.body).digest('hex');
      isValid = secretsMatch(signature, hash);
    }

    if (!isValid) {
      safeLogAudit('AUTH_FAILED', { ip: reqIp });
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    let payload = req.body;
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch { payload = {}; }
    }
    payload = payload || {};

    const event = payload.event || payload.type;
    const externalId = payload.external_id || payload.externalId || payload.data?.external_id;
    const internalId = payload.internal_id || payload.internalId || payload.id || payload.data?.internal_id;
    const status = payload.status || payload.data?.status;

    safeLogAudit('WEBHOOK_RECEIVED', { ip: reqIp, externalId, internalId, event, status });

    const isPaidEvent =
      event === 'deposit.paid' ||
      event === 'pix.paid' ||
      event === 'payment.paid' ||
      status === 'paid' ||
      status === 'PAID' ||
      status === 'CONFIRMED' ||
      status === 'approved';

    if (!isPaidEvent) {
      safeLogAudit('IGNORED_EVENT', { reason: 'Not a paid event or status', event, status });
      return res.status(200).json({ success: true, message: 'OK' });
    }

    if (!externalId && !internalId) {
      safeLogAudit('INVALID_PAYLOAD', { reason: 'Missing identifiers' });
      return res.status(200).json({ success: true, message: 'OK' });
    }

    let purchase: any = null;
    if (externalId) {
      const { data } = await supabase.from('purchases').select('*').eq('id', externalId).maybeSingle();
      purchase = data;
    }
    if (!purchase && internalId) {
      const { data } = await supabase
        .from('purchases')
        .select('*')
        .eq('payment_internal_id', internalId)
        .maybeSingle();
      purchase = data;
    }

    if (!purchase) {
      safeLogAudit('PURCHASE_NOT_FOUND', { externalId, internalId });
      return res.status(200).json({ success: true, message: 'OK' });
    }

    if (purchase.payment_status === 'paid' || purchase.status === 'paid' || purchase.status === 'CONFIRMED') {
      safeLogAudit('IDEMPOTENT_IGNORE', { purchaseId: purchase.id, status: purchase.status });
      return res.status(200).json({ success: true, message: 'OK' });
    }

    if (purchase.status === 'cancelled' || purchase.payment_status === 'cancelled') {
      safeLogAudit('CANCELLED_PURCHASE_WEBHOOK', { purchaseId: purchase.id });
      return res.status(200).json({ success: true, message: 'OK' });
    }

    /**
     * The transaction id used for verification comes from our own record, never
     * from the request body.
     *
     * Taking it from the payload let a caller pair their own purchase id with
     * the transaction id of somebody else's genuinely-paid PIX: the
     * confirmation lookup then succeeded against that unrelated transaction and
     * released tickets without payment.
     */
    const targetInternalId = purchase.payment_internal_id;
    if (!targetInternalId) {
      safeLogAudit('MISSING_INTERNAL_ID_FOR_CONSULT', { purchaseId: purchase.id });
      return res.status(200).json({ success: true, message: 'OK' });
    }

    if (internalId && internalId !== targetInternalId) {
      safeLogAudit('INTERNAL_ID_MISMATCH', {
        purchaseId: purchase.id,
        reported: internalId,
        stored: targetInternalId,
      });
      return res.status(200).json({ success: true, message: 'OK' });
    }

    let customCreds = undefined;
    if (purchase.source === 'ghost') {
      const { data: configData } = await supabase
        .from('app_config')
        .select('key, value')
        .in('key', ['ghost_client_id', 'ghost_client_secret']);

      let ghostClientId = '';
      let ghostClientSecret = '';
      configData?.forEach(row => {
        if (row.key === 'ghost_client_id') ghostClientId = row.value;
        if (row.key === 'ghost_client_secret') ghostClientSecret = row.value;
      });
      if (ghostClientId && ghostClientSecret) {
        customCreds = { clientId: ghostClientId, clientSecret: ghostClientSecret };
      }
    }

    safeLogAudit('INITIATING_DOUBLE_CHECK', {
      purchaseId: purchase.id,
      internalId: targetInternalId,
      source: purchase.source,
    });

    /**
     * Dupla checagem contra a Simplify.
     *
     * A documentação oficial descreve apenas POST /pix/deposit e os webhooks —
     * não há endpoint publicado para consultar o status de um depósito. Se a
     * consulta falhar por isso, tratar como "falha" bloqueava a confirmação:
     * o handler devolvia 500, a Simplify tentava 3 vezes, e as cotas do cliente
     * que pagou nunca eram liberadas.
     *
     * A verificação continua sendo feita quando a API responde. Quando ela não
     * responde, o webhook autenticado é aceito como fonte: a URL que a Simplify
     * chama carrega o WEBHOOK_SECRET, então só quem recebeu essa URL consegue
     * chegar até aqui.
     */
    const consultRes = await paymentService.consultPixPayment(targetInternalId, customCreds);

    let verified = false;

    if (consultRes.success) {
      const confirmedStatus = (consultRes.status || '').toLowerCase();
      const isActuallyPaid =
        confirmedStatus === 'paid' || confirmedStatus === 'confirmed' || confirmedStatus === 'approved';

      if (!isActuallyPaid) {
        // A API respondeu e disse que NÃO está pago: recusa definitiva.
        safeLogAudit('DOUBLE_CHECK_NOT_PAID', {
          purchaseId: purchase.id,
          internalId: targetInternalId,
          status: consultRes.status,
        });
        return res.status(200).json({ success: true, message: 'OK' });
      }

      verified = true;
      safeLogAudit('DOUBLE_CHECK_SUCCESS', { purchaseId: purchase.id });
    } else {
      safeLogAudit('DOUBLE_CHECK_UNAVAILABLE', {
        purchaseId: purchase.id,
        internalId: targetInternalId,
        error: consultRes.error,
        note: 'Confirmando pelo webhook autenticado.',
      });
    }

    /**
     * Confere o valor liquidado contra o valor devido, para que um pagamento
     * parcial ou adulterado não libere o pedido inteiro. Usa os dados da
     * consulta quando existem; caso contrário, o valor informado no webhook.
     */
    const raw = consultRes.raw || payload || {};
    const paidAmountRaw = raw.amount ?? raw.value ?? raw.data?.amount ?? raw.data?.value;
    if (paidAmountRaw !== undefined && paidAmountRaw !== null) {
      const paidAmount = Number(paidAmountRaw);
      const expectedAmount = Number(purchase.total_value);
      // Tolerate sub-cent representation differences only.
      if (Number.isFinite(paidAmount) && Math.abs(paidAmount - expectedAmount) > 0.01) {
        safeLogAudit('AMOUNT_MISMATCH', {
          purchaseId: purchase.id,
          expected: expectedAmount,
          paid: paidAmount,
        });
        return res.status(200).json({ success: true, message: 'OK' });
      }
    }

    safeLogAudit('RELEASING_TICKETS', { purchaseId: purchase.id, verified });

    const confirmResult = await raffleService.confirmPaymentAndReleaseTickets(purchase.id);

    if (confirmResult.success) {
      safeLogAudit('TICKETS_RELEASED', {
        purchaseId: purchase.id,
        tickets: confirmResult.ticketsReleased,
      });
    } else {
      safeLogAudit('TICKET_RELEASE_FAILED', {
        purchaseId: purchase.id,
        error: confirmResult.error,
      });
      // Ask Simplify to retry: the payment is real but our side did not commit.
      return res.status(500).json({ success: false, message: 'Ticket release failed' });
    }

    return res.status(200).json({ success: true, message: 'OK' });
  } catch (err: any) {
    safeLogAudit('WEBHOOK_CRITICAL_ERROR', { error: err?.message });
    return res.status(500).json({ success: false, message: 'Internal error' });
  }
}

export { handleSimplifyWebhook };
