import { supabaseServer as supabase } from './supabaseServer';

export interface PayerData {
  name: string;
  email: string;
  cpf: string;
  phone: string;
}

export interface SimplifyPixPayload {
  amount: number;
  /** Opcional: omitido quando WEBHOOK_URL não é uma URL pública em HTTPS. */
  webhookURL?: string;
  external_id: string;
  payer: {
    name: string;
    email: string;
    document: string;
    phone: string;
  };
}

export interface SimplifyPixResponse {
  success: boolean;
  internal_id?: string;
  qrCode?: string;
  pixCode?: string;
  status?: string;
  raw?: any;
  error?: string;
}

export const paymentService = {
  validatePayerData(payer: Partial<PayerData>): PayerData {
    const cleanCpf = (payer.cpf || '').replace(/\D/g, '');
    const cleanPhone = (payer.phone || '').replace(/\D/g, '');

    const name = payer.name && payer.name.trim() ? payer.name.trim() : 'Cliente';
    const email = payer.email && payer.email.includes('@') ? payer.email.trim() : `cliente_${cleanCpf || Date.now()}@example.invalid`;
    const document = cleanCpf.length === 11 ? cleanCpf : '00000000000';
    const phone = cleanPhone.length >= 10 ? cleanPhone : '11999999999';

    return {
      name,
      email,
      cpf: document,
      phone
    };
  },

  /**
   * Monta o corpo do POST /pix/deposit conforme a documentação da Simplify.
   *
   * O webhook da Simplify não envia assinatura nem header de autenticação — a
   * documentação não define nenhum. Por isso o segredo compartilhado viaja como
   * query string na própria webhookURL, que só a Simplify recebe. O handler em
   * api/_handlers/webhook/simplify.ts aceita esse valor via `req.query.token`.
   *
   * Sem isso, com WEBHOOK_SECRET configurado, todo webhook legítimo seria
   * rejeitado com 401 e nenhum pagamento seria confirmado.
   */
  buildSimplifyPayload(purchase: { id: string; total_value: number }, payer: PayerData): SimplifyPixPayload {
    const base = process.env.WEBHOOK_URL || '';
    if (!base) {
      console.error('[PAYMENT] WEBHOOK_URL não configurada: a Simplify não terá para onde notificar o pagamento.');
    }

    /**
     * A Simplify exige uma URL pública em HTTPS e recusa a cobrança inteira com
     * "A URL informada não é válida" se receber outra coisa — incluindo
     * http://localhost durante o desenvolvimento.
     *
     * Como o campo é opcional na documentação, uma URL inválida é omitida em
     * vez de derrubar a geração do PIX. Em produção isso significa que o
     * pagamento é gerado mesmo com WEBHOOK_URL mal configurada; o aviso no log
     * indica que a confirmação automática não vai chegar.
     */
    let webhookURL: string | undefined;
    if (base) {
      let valid = false;
      try {
        const parsed = new URL(base);
        const host = parsed.hostname.toLowerCase();
        const isLocal =
          host === 'localhost' ||
          host === '127.0.0.1' ||
          host === '::1' ||
          host.endsWith('.local');
        valid = parsed.protocol === 'https:' && !isLocal;
      } catch {
        valid = false;
      }

      if (valid) {
        const secret = process.env.WEBHOOK_SECRET;
        webhookURL = secret && !base.includes('token=')
          ? `${base}${base.includes('?') ? '&' : '?'}token=${encodeURIComponent(secret)}`
          : base;
      } else {
        console.warn(
          `[PAYMENT] WEBHOOK_URL ignorada ("${base}"): a Simplify exige HTTPS público. O PIX será gerado, mas a confirmação automática não chegará.`
        );
      }
    }

    return {
      amount: Number(purchase.total_value),
      ...(webhookURL ? { webhookURL } : {}),
      external_id: purchase.id,
      payer: {
        name: payer.name,
        email: payer.email,
        document: payer.cpf,
        phone: payer.phone
      }
    };
  },

  logRequestResponse(type: string, data: any) {
    // Fire and forget
    supabase.from('audit_logs').insert({
      admin_email: 'system@simplify-debug',
      action_type: type,
      details: JSON.stringify(data).substring(0, 5000)
    }).then(() => {}, (e) => console.error("Audit log failed", e));
  },

  async sendToSimplify(payload: SimplifyPixPayload, customCreds?: {clientId: string, clientSecret: string}): Promise<SimplifyPixResponse> {
    const clientId = customCreds?.clientId || process.env.SIMPLIFY_CLIENT_ID;
    const clientSecret = customCreds?.clientSecret || process.env.SIMPLIFY_CLIENT_SECRET;


    this.logRequestResponse('SEND_TO_SIMPLIFY_REQUEST', {
      url: 'https://simplifybr.com/api/v1/pix/deposit',
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      payload
    });

    if (!clientId || !clientSecret) {
      this.logRequestResponse('SEND_TO_SIMPLIFY_ERROR', { error: 'SIMPLIFY_CLIENT_ID or SIMPLIFY_CLIENT_SECRET missing.' });
      return {
        success: false,
        error: 'Credenciais da Simplify (SIMPLIFY_CLIENT_ID e SIMPLIFY_CLIENT_SECRET) não configuradas no servidor.'
      };
    }

    try {
      const response = await fetch('https://simplifybr.com/api/v1/pix/deposit', {
        method: 'POST',
        headers: {
          'client-id': clientId,
          'client-secret': clientSecret,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });


      const responseText = await response.text();

      let resData: any;
      try {
        resData = JSON.parse(responseText);
      } catch {
        resData = { message: responseText };
      }

      this.logRequestResponse('SEND_TO_SIMPLIFY_RESPONSE', {
        status: response.status,
        ok: response.ok,
        data: resData
      });

      if (!response.ok) {
        return {
          success: false,
          error: resData?.message || resData?.error || `Simplify API returned status ${response.status}`,
          raw: resData
        };
      }

      /**
       * Resposta documentada do POST /pix/deposit:
       *
       *   { "internal_id", "external_id", "status", "qrcode", "amount" }
       *
       * O campo `qrcode` é o PIX copia-e-cola (string EMV, começa com "000201"),
       * NÃO uma imagem. A versão anterior o colocava no campo de imagem e, logo
       * abaixo, embrulhava qualquer string com mais de 100 caracteres em
       * `data:image/png;base64,...` — o que transformava o código PIX válido
       * numa imagem quebrada na tela de pagamento.
       *
       * Os nomes alternativos seguem como tolerância a variações da API, mas
       * `qrcode` (documentado) tem prioridade para o copia-e-cola.
       */
      const internal_id = resData?.internal_id || resData?.data?.internal_id || resData?.id || resData?.data?.id;

      const pixCode =
        resData?.qrcode ||
        resData?.data?.qrcode ||
        resData?.pix_copy_paste || resData?.copy_paste || resData?.pix_code || resData?.emv ||
        resData?.data?.pix_copy_paste || resData?.data?.copy_paste || resData?.data?.pix_code || resData?.data?.emv ||
        '';

      /**
       * Imagem do QR: a Simplify não retorna uma, então isto normalmente fica
       * vazio e o frontend desenha o QR a partir do copia-e-cola com
       * <QRCodeSVG value={pixCode} /> (qrcode.react). Só é preenchido se a API
       * passar a devolver uma URL ou um data URI de verdade.
       */
      let qrCode = '';
      const imageCandidate =
        resData?.qr_code_url || resData?.pix_qr_code || resData?.qr_code_base64 ||
        resData?.data?.qr_code_url || resData?.data?.pix_qr_code || resData?.data?.qr_code_base64;

      if (typeof imageCandidate === 'string' && imageCandidate) {
        if (imageCandidate.startsWith('http') || imageCandidate.startsWith('data:image')) {
          qrCode = imageCandidate;
        } else if (imageCandidate.startsWith('iVBOR')) {
          // Assinatura de PNG em base64.
          qrCode = `data:image/png;base64,${imageCandidate}`;
        }
      }

      if (!pixCode) {
        console.error('[PAYMENT] resposta da Simplify sem código PIX:', JSON.stringify(resData).slice(0, 500));
        return {
          success: false,
          error: 'A Simplify não retornou o código PIX. Verifique as credenciais e o formato da resposta.',
          raw: resData
        };
      }

      const status = resData?.status || resData?.data?.status || resData?.pix?.status || 'pending';

      return {
        success: true,
        internal_id,
        qrCode,
        pixCode,
        status,
        raw: resData
      };
    } catch (err: any) {
      console.error('SIMPLIFY FETCH EXCEPTION:', err);
      this.logRequestResponse('SEND_TO_SIMPLIFY_ERROR', { error: err?.message || String(err) });
      return {
        success: false,
        error: `Falha na conexão com a Simplify: ${err?.message || String(err)}`
      };
    }
  },

  async consultPixPayment(internalId: string, customCreds?: {clientId: string, clientSecret: string}): Promise<SimplifyPixResponse> {
    const clientId = customCreds?.clientId || process.env.SIMPLIFY_CLIENT_ID;
    const clientSecret = customCreds?.clientSecret || process.env.SIMPLIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('[PAYMENT] SIMPLIFY_CLIENT_ID / SIMPLIFY_CLIENT_SECRET not configured.');
      return {
        success: false,
        error: 'Credenciais da Simplify não configuradas no servidor.'
      };
    }

    this.logRequestResponse('CONSULT_SIMPLIFY_REQUEST', {
      url: `https://simplifybr.com/api/v1/pix/deposit/${internalId}`,
      internalId
    });

    try {
      const response = await fetch(`https://simplifybr.com/api/v1/pix/deposit/${internalId}`, {
        method: 'GET',
        headers: {
          'client-id': clientId,
          'client-secret': clientSecret,
          'Content-Type': 'application/json'
        }
      });

      const responseText = await response.text();
      let resData: any = {};
      try { resData = JSON.parse(responseText); } catch {}

      this.logRequestResponse('CONSULT_SIMPLIFY_RESPONSE', {
        status: response.status,
        data: resData
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Simplify API returned status ${response.status}`,
          raw: resData
        };
      }

      const status = resData?.status || resData?.data?.status || resData?.pix?.status || 'pending';
      const fetchedInternalId = resData?.internal_id || resData?.data?.internal_id || resData?.id;

      return {
        success: true,
        internal_id: fetchedInternalId || internalId,
        status,
        raw: resData
      };
    } catch (err: any) {
      console.error('SIMPLIFY CONSULT EXCEPTION:', err);
      this.logRequestResponse('CONSULT_SIMPLIFY_ERROR', { error: err?.message || String(err) });
      return { success: false, error: 'Connection failed' };
    }
  },

  async createPixPayment(purchaseId: string, customPayer?: Partial<PayerData>, customCreds?: {clientId: string, clientSecret: string}): Promise<SimplifyPixResponse> {
    try {
      // 1. Fetch purchase
      const { data: purchase, error: pErr } = await supabase
        .from('purchases')
        .select('*')
        .eq('id', purchaseId)
        .single();

      if (pErr || !purchase) {
        console.error('[PAYMENT_SERVICE] Error fetching purchase:', pErr);
        return { success: false, error: 'Purchase not found' };
      }


      // 2. Fetch profile if available and not guest
      let profile: any = {};
      if (purchase.user_id && purchase.user_id !== 'guest') {
        const { data: profData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', purchase.user_id)
          .maybeSingle();
        if (profData) {
          profile = profData;
        }
      }
      const payerInput: Partial<PayerData> = {
        name: customPayer?.name || profile.full_name,
        email: customPayer?.email || profile.email,
        cpf: customPayer?.cpf || profile.cpf,
        phone: customPayer?.phone || profile.phone
      };

      const payer = this.validatePayerData(payerInput);

      // 3. Build Payload
      const payload = this.buildSimplifyPayload(purchase, payer);

      // 4. Send to Simplify
      const simplifyResult = await this.sendToSimplify(payload, customCreds);

      if (!simplifyResult.success) {
        console.error('[PAYMENT_SERVICE] Simplify API call failed:', simplifyResult.error);
        return {
          success: false,
          error: simplifyResult.error || 'Erro ao gerar PIX com a Simplify.'
        };
      }

      // 5. Save Simplify data to DB
      const pixCode = simplifyResult.pixCode || '';
      /**
       * Sem fallback para gerador de QR externo.
       *
       * O valor anterior mandava o codigo PIX do cliente para api.qrserver.com
       * e ainda gravava essa URL de terceiro no banco. O CheckoutModal desenha
       * o QR localmente com <QRCodeSVG value={pixCode} />, entao esse campo so
       * e preenchido se a propria Simplify devolver uma imagem.
       */
      const qrCode = simplifyResult.qrCode || '';

      await supabase
        .from('purchases')
        .update({
          pix_code: pixCode,
          pix_qr_code: qrCode,
          pix_copy_paste: pixCode,
          payment_internal_id: simplifyResult.internal_id || null,
          payment_status: simplifyResult.status || 'pending'
        })
        .eq('id', purchase.id);

      return {
        success: true,
        internal_id: simplifyResult.internal_id,
        pixCode,
        qrCode,
        status: simplifyResult.status || 'pending'
      };
    } catch (err: any) {
      console.error('[PAYMENT_SERVICE] Error in createPixPayment:', err);
      return {
        success: false,
        error: err?.message || 'Internal error creating PIX payment'
      };
    }
  }
};
