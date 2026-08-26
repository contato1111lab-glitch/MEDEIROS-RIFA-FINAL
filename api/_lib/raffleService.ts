import { supabaseServer as supabase } from './supabaseServer';
import { verifyMasterPassword as checkMasterPassword } from './auth';
import { deleteStorageObject } from './storage';

import type { Raffle, RaffleStatus, Purchase, Profile, Winner, WinningTicket, Banner } from '../../types';

export const raffleService = {

  /**
   * Devolve ao estoque as cotas reservadas que nunca viraram pagamento.
   *
   * A versão anterior partia de `purchases` filtrando
   * `payment_status = 'pending'`, e por isso não limpava nada: convivem duas
   * convenções de status neste banco. A RPC antiga grava
   * `status = 'PENDING'` com `payment_status = NULL`, a nova grava
   * `status = 'pending'` / `payment_status = 'pending'`. Reservas gravadas pela
   * primeira ficavam presas para sempre — foi assim que 16 cotas sumiram do
   * estoque sem nenhuma venda paga.
   *
   * Agora a varredura parte do próprio pool, que é a fonte da verdade sobre o
   * estoque, e só devolve cotas cuja compra comprovadamente não foi paga.
   */
  async cancelExpiredPurchases(timeoutMinutes: number = 30): Promise<void> {
    try {
      const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000).toISOString();

      const { data: stale, error } = await supabase
        .from('raffle_ticket_pool')
        .select('id, purchase_id, reserved_at')
        .eq('status', 'RESERVED')
        .or(`reserved_at.lt.${cutoff},reserved_at.is.null`);

      if (error) {
        console.error('[CLEANUP] leitura do pool falhou:', error);
        return;
      }
      if (!stale || stale.length === 0) return;

      // Cotas RESERVED sem compra nenhuma: órfãs, voltam direto.
      const orphans = stale.filter(t => !t.purchase_id).map(t => t.id);
      if (orphans.length > 0) {
        await supabase
          .from('raffle_ticket_pool')
          .update({ status: 'AVAILABLE', purchase_id: null, owner_user_id: null, reserved_at: null })
          .in('id', orphans);
        console.log(`[CLEANUP] ${orphans.length} cota(s) órfã(s) devolvida(s) ao estoque.`);
      }

      const purchaseIds = [...new Set(stale.map(t => t.purchase_id).filter(Boolean))] as string[];
      if (purchaseIds.length === 0) return;

      const { data: purchases } = await supabase
        .from('purchases')
        .select('id, status, payment_status')
        .in('id', purchaseIds);

      const byId = new Map((purchases || []).map(p => [p.id, p]));

      // Nunca mexer numa compra paga: comparação em minúsculas porque as duas
      // convenções coexistem ('paid' e 'PAID').
      const isPaid = (p: any) =>
        String(p?.payment_status || '').toLowerCase() === 'paid' ||
        String(p?.status || '').toLowerCase() === 'paid';

      const toRelease = purchaseIds.filter(pid => {
        const p = byId.get(pid);
        // Compra sumiu do banco: a reserva não tem mais dono, pode voltar.
        if (!p) return true;
        return !isPaid(p);
      });

      if (toRelease.length === 0) return;

      const { error: relErr } = await supabase
        .from('raffle_ticket_pool')
        .update({ status: 'AVAILABLE', purchase_id: null, owner_user_id: null, reserved_at: null })
        .in('purchase_id', toRelease)
        .eq('status', 'RESERVED');

      if (relErr) {
        console.error('[CLEANUP] devolução das cotas falhou:', relErr);
        return;
      }

      await supabase
        .from('purchases')
        .update({ status: 'cancelled', payment_status: 'cancelled' })
        .in('id', toRelease.filter(pid => byId.has(pid)));

      console.log(`[CLEANUP] ${toRelease.length} reserva(s) expirada(s) cancelada(s).`);
    } catch (err) {
      console.error('[CLEANUP] falhou:', err);
    }
  },
  /**
   * Full detail for one purchase, served to the buyer through
   * GET /api/purchases/:id.
   *
   * The checkout and success screens used to read `purchases`,
   * `raffle_ticket_pool` and `profiles` straight from the browser with the
   * anon key, which is why those tables had to stay world-readable. Going
   * through the server means row level security can lock them down.
   *
   * The purchase id is an unguessable UUID and acts as the capability to view
   * this order.
   */
  async getPurchaseById(id: string) {
    const { data, error } = await supabase
      .from('purchases')
      .select('*, raffles(id, name, image_url, status, total_numbers)')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;

    const { data: tickets } = await supabase
      .from('raffle_ticket_pool')
      .select('ticket_number')
      .eq('purchase_id', id)
      .order('ticket_number', { ascending: true });

    let profile: any = null;
    let registrationComplete = false;
    if (data.user_id && data.user_id !== 'guest') {
      const { data: prof } = await supabase
        .from('profiles')
        .select('id, full_name, cpf, phone, role, created_at')
        .eq('id', data.user_id)
        .maybeSingle();
      if (prof) {
        const dbPhone = (prof.phone || '').replace(/\D/g, '');
        const hasName = !!(prof.full_name && prof.full_name.trim() && !prof.full_name.startsWith('Cliente '));
                                                                        registrationComplete = hasName && true;

        profile = {
          id: prof.id,
          fullName: prof.full_name,
          cpf: prof.cpf,
          phone: prof.phone,
                                                                                                    role: prof.role,
          createdAt: prof.created_at
        };
        if (hasName && dbPhone.length >= 10) {
          registrationComplete = true;
        }
      }
    }

    return {
      id: data.id,
      userId: data.user_id,
      raffleId: data.raffle_id,
      quantity: data.quantity,
      totalValue: data.total_value,
      ticketPrice: data.ticket_price,
      status: data.status,
      paymentStatus: data.payment_status,
      pixCode: data.pix_code,
      pixQrCode: data.pix_qr_code,
      createdAt: data.created_at,
      ticketNumbers: (tickets || []).map(t => t.ticket_number),
      registrationComplete,
      raffle: data.raffles
        ? {
            id: data.raffles.id,
            name: data.raffles.name,
            imageUrl: data.raffles.image_url,
            status: data.raffles.status,
          }
        : null,
      profile,
    };
  },
  /**
   * Marks a purchase paid and turns its reserved tickets into owned tickets.
   *
   * Delegates to rpc_confirm_payment so the whole thing is one database
   * transaction. The previous version issued two independent updates, which
   * could mark the purchase paid and then fail to flip the tickets, leaving a
   * paying customer with no cotas. The RPC is also idempotent and re-draws
   * tickets when the original reservation already expired.
   */
  async confirmPaymentAndReleaseTickets(
    purchaseId: string
  ): Promise<{ success: boolean; ticketsReleased?: number; error?: string }> {
    const { data: purchase, error: readErr } = await supabase
      .from('purchases')
      .select('id, quantity, raffle_id, user_id')
      .eq('id', purchaseId)
      .maybeSingle();

    if (readErr || !purchase) {
      return { success: false, error: readErr?.message || 'Compra não encontrada.' };
    }

    const { error } = await supabase.rpc('rpc_confirm_payment', { p_purchase_id: purchaseId });

    if (error) {
      console.error('[CONFIRM_PAYMENT] rpc_confirm_payment failed:', error);
      return { success: false, error: error.message };
    }

    // Now, after success, fetch all tickets associated with this purchase
    const { data: paidTickets } = await supabase
      .from('raffle_ticket_pool')
      .select('ticket_number')
      .eq('purchase_id', purchaseId)
      .eq('status', 'PAID');

    let ticketsReleased = 0;
    
    if (paidTickets && paidTickets.length > 0) {
      ticketsReleased = paidTickets.length;
      const ticketNumbers = paidTickets.map(t => t.ticket_number);

      // Check if any of these are active winning tickets that haven't been won yet
      const { data: winningTix } = await supabase
        .from('winning_tickets')
        .select('id, ticket_number, prize_description')
        .eq('raffle_id', purchase.raffle_id)
        .in('ticket_number', ticketNumbers)
        .eq('is_active', true)
        .eq('won', false);

      if (winningTix && winningTix.length > 0) {
        for (const wt of winningTix) {
          // 1) Mark as won in winning_tickets
          await supabase
            .from('winning_tickets')
            .update({ won: true, user_id: purchase.user_id })
            .eq('id', wt.id)
            .eq('won', false); // Extra safety

          // 2) Insert into winners with idempotency
          await supabase
            .from('winners')
            .upsert({
              raffle_id: purchase.raffle_id,
              user_id: purchase.user_id,
              ticket_number: wt.ticket_number,
              prize: wt.prize_description,
              prize_type: 'bilhete',
              draw_date: new Date().toISOString()
            }, {
              onConflict: 'raffle_id,ticket_number,prize_type'
            });
        }
      }
    }

    return { success: true, ticketsReleased: ticketsReleased || purchase.quantity };
  },

  // --- RAFFLES ---

  async getRaffleById(id: string): Promise<Raffle | null> {
    const { data, error } = await supabase
      .from('raffles')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !data) return null;
    
      /**
       * Cotas vendidas = apenas as pagas.
       *
       * A contagem não filtrava por status, então somava TODAS as linhas do
       * pool — que é exatamente total_numbers quando o pool está completo. Na
       * prática, toda rifa com o pool gerado aparecia com 100% de progresso e
       * "esgotada", no painel e na barra da Home, mesmo sem uma única venda.
       *
       * Reservadas não entram: elas ainda não foram pagas e voltam ao estoque
       * se o PIX expirar, o que faria a barra andar para trás.
       */
    const { count } = await supabase
      .from('raffle_ticket_pool')
      .select('*', { count: 'exact', head: true })
      .eq('raffle_id', id)
      .eq('status', 'PAID');

    return {
      id: data.id,
      name: data.name,
      description: data.description,
      fullDescription: data.full_description,
      imageUrl: data.image_url,
      totalNumbers: data.total_numbers,
      soldNumbers: count || 0,
      fakeSoldNumbers: data.fake_sold_count || 0,
      pricePerNumber: data.price_per_number,
      minPurchase: data.min_purchase || 1,
      status: data.status as RaffleStatus,
      drawDate: data.draw_date,
      isFeatured: data.is_featured || false,
      useSecondaryGateway: data.use_secondary_gateway || false,
      rankingConfig: data.ranking_config || [],
      rankingStartDate: data.ranking_start_date,
      rankingEndDate: data.ranking_end_date,
      securityMarginPercent: data.security_margin_percent || 0,
      manualRanking: data.manual_ranking || [],
      showPromoBanner: data.show_promo_banner ?? true,
      promoBannerTitle: data.promo_banner_title,
      promoBannerSubtitle: data.promo_banner_subtitle,
      showRanking: data.show_ranking ?? true,
      termsAndRules: data.terms_and_rules
    };
  },

  
  /**
   * Verifies the super-admin master password against SUPER_ADMIN_PASSWORD_HASH.
   * It is no longer read from app_config: that table is reachable with the
   * public anon key, so a plain-text password there was world-readable.
   */
  async superAdminLogin(password: string): Promise<boolean> {
    return checkMasterPassword(password);
  },

  async verifyMasterPassword(password: string): Promise<boolean> {
    return checkMasterPassword(password);
  },

  async getAllRaffles(): Promise<Raffle[]> {
    /**
     * Destaque primeiro, depois da mais recente para a mais antiga.
     *
     * Nao havia .order() nenhum aqui, entao o Postgres devolvia as linhas em
     * ordem arbitraria e as rifas novas caiam no fim da lista. A Home usa
     * activeRaffles[0] como card grande de destaque, entao a ordem tambem
     * decide qual rifa aparece em destaque: marcar is_featured fixa a rifa
     * na primeira posicao.
     */
    const { data, error } = await supabase
      .from('raffles')
      .select('*')
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;

    return Promise.all(data.map(async (r: any) => {
      /**
       * Cotas vendidas = apenas as pagas.
       *
       * A contagem não filtrava por status, então somava TODAS as linhas do
       * pool — que é exatamente total_numbers quando o pool está completo. Na
       * prática, toda rifa com o pool gerado aparecia com 100% de progresso e
       * "esgotada", no painel e na barra da Home, mesmo sem uma única venda.
       *
       * Reservadas não entram: elas ainda não foram pagas e voltam ao estoque
       * se o PIX expirar, o que faria a barra andar para trás.
       */
      const { count } = await supabase
        .from('raffle_ticket_pool')
        .select('*', { count: 'exact', head: true })
        .eq('raffle_id', r.id)
        .eq('status', 'PAID');

      return {
        id: r.id,
        name: r.name,
        description: r.description,
        fullDescription: r.full_description,
        imageUrl: r.image_url,
        totalNumbers: r.total_numbers,
        soldNumbers: count || 0,
        fakeSoldNumbers: r.fake_sold_count || 0,
        pricePerNumber: r.price_per_number,
        minPurchase: r.min_purchase || 1,
        status: r.status as RaffleStatus,
        drawDate: r.draw_date,
        isFeatured: r.is_featured || false,
        
        
        
        useSecondaryGateway: r.use_secondary_gateway || false,
        rankingConfig: r.ranking_config || [],
        rankingStartDate: r.ranking_start_date,
        rankingEndDate: r.ranking_end_date,
        securityMarginPercent: r.security_margin_percent || 0,
        manualRanking: r.manual_ranking || [],
        showPromoBanner: r.show_promo_banner ?? true,
        promoBannerTitle: r.promo_banner_title,
        promoBannerSubtitle: r.promo_banner_subtitle,
        showRanking: r.show_ranking ?? true,
        termsAndRules: r.terms_and_rules
      };
    }));
  },

  async superAdminGetAllRaffles(): Promise<any[]> {
    const { data } = await supabase.from('raffles').select('*').order('created_at', { ascending: false });
    return data || [];
  },

  async superAdminGetHiddenPurchases(): Promise<any[]> {
    const { data } = await supabase.from('purchases').select('*, profiles(*)').eq('is_hidden', true);
    return data || [];
  },

  async superAdminGetConfig(): Promise<any> {
    const { data } = await supabase.from('app_config').select('*').in('key', ['secondary_gateway_public_key', 'secondary_gateway_private_key']);
    const config: any = {};
    data?.forEach(row => {
      config[row.key] = row.value;
    });
    return config;
  },

  async superAdminUpdateConfig(config: { publicKey: string, privateKey: string }): Promise<void> {
    await supabase.from('app_config').upsert([
      { key: 'secondary_gateway_public_key', value: config.publicKey },
      { key: 'secondary_gateway_private_key', value: config.privateKey }
    ]);
  },

  // --- GHOST MODE METHODS (SUPERADMIN ONLY) ---
  
  async getGhostConfig(): Promise<any> {
    const keys = ['ghost_mode_enabled', 'ghost_client_id', 'ghost_client_secret'];
    const { data } = await supabase.from('app_config').select('key, value').in('key', keys);
    const config = { enabled: false, clientId: '', clientSecret: '' };
    data?.forEach(row => {
      if (row.key === 'ghost_mode_enabled') config.enabled = row.value === 'true';
      if (row.key === 'ghost_client_id') config.clientId = row.value;
      if (row.key === 'ghost_client_secret') config.clientSecret = row.value;
    });
    return config;
  },

  async updateGhostConfig(enabled: boolean, clientId: string, clientSecret: string, adminId: string): Promise<void> {
    await supabase.from('app_config').upsert({ key: 'ghost_mode_enabled', value: enabled ? 'true' : 'false' }, { onConflict: 'key' });
    if (clientId !== undefined) await supabase.from('app_config').upsert({ key: 'ghost_client_id', value: clientId }, { onConflict: 'key' });
    if (clientSecret !== undefined && clientSecret !== '***') await supabase.from('app_config').upsert({ key: 'ghost_client_secret', value: clientSecret }, { onConflict: 'key' });
    
    await supabase.from('ghost_audit_log').insert({
      action: 'GHOST_CONFIG_CHANGED',
      admin_id: adminId,
      new_state: { enabled, clientId }
    });
  },

  async getGhostMetrics(): Promise<any> {
    const { data: sales, error } = await supabase
      .from('purchases')
      .select('status, total_value, is_hidden, transferred_to_admin, source');
      
    let normalRevenue = 0;
    let ghostRevenue = 0;
    let ghostCount = 0;
    let ghostTransferredCount = 0;

    sales?.forEach(s => {
      if (s.status === 'paid' || s.status === 'CONFIRMED') {
        if (s.source === 'normal') normalRevenue += s.total_value;
        if (s.source === 'ghost') ghostRevenue += s.total_value;
      }
      if (s.source === 'ghost') {
        ghostCount++;
        if (s.transferred_to_admin) ghostTransferredCount++;
      }
    });

    return {
      normalRevenue,
      ghostRevenue,
      consolidatedRevenue: normalRevenue + ghostRevenue,
      ghostCount,
      ghostTransferredCount
    };
  },

  async getGhostPurchases(): Promise<any[]> {
    const { data } = await supabase
      .from('purchases')
      .select('*, profiles(*)')
      .eq('source', 'ghost')
      .order('created_at', { ascending: false });
    return data || [];
  },

  async transferGhostToAdmin(purchaseId: string, adminId: string): Promise<void> {
    const { data: p } = await supabase.from('purchases').select('*').eq('id', purchaseId).single();
    if (!p) throw new Error('Venda não encontrada');
    if (p.source !== 'ghost') throw new Error('Esta venda não é Ghost');
    if (p.transferred_to_admin) throw new Error('Venda já transferida');
    
    await supabase.from('purchases').update({
      is_hidden: false,
      transferred_to_admin: true,
      transferred_at: new Date().toISOString(),
      transferred_by: adminId
    }).eq('id', purchaseId);

    await supabase.from('ghost_audit_log').insert({
      action: 'GHOST_PURCHASE_TRANSFERRED',
      admin_id: adminId,
      purchase_id: purchaseId,
      old_state: { is_hidden: true, transferred_to_admin: false },
      new_state: { is_hidden: false, transferred_to_admin: true }
    });
  },

  async getGhostAuditLogs(): Promise<any[]> {
    const { data } = await supabase.from('ghost_audit_log').select('*').order('created_at', { ascending: false }).limit(100);
    return data || [];
  },

  async superAdminRevealPurchase(id: string): Promise<void> {
    await supabase.from('purchases').update({ is_hidden: false }).eq('id', id);
  },

  async toggleAuditLogVisibility(id: string, hidden: boolean): Promise<void> {
    await supabase.from('audit_logs').update({ is_hidden: hidden }).eq('id', id);
  },

  async approvePurchaseManually(purchaseId: string, adminEmail: string, masterPassword?: string): Promise<{success: boolean, message: string}> {
    if (masterPassword) {
      const isValid = await this.verifyMasterPassword(masterPassword);
      if (!isValid) return { success: false, message: 'Senha mestra incorreta.' };
    }
    
    await this.approvePurchase(purchaseId);
    await this.logAuditAction(adminEmail, 'APROVAÇÃO MANUAL', `Aprovou compra ${purchaseId}`);
    return { success: true, message: 'Sucesso' };
  },

  async swapTicket(purchaseId: string, newNumber: number, adminEmail: string, masterPassword?: string): Promise<{success: boolean, message: string}> {
    // Note: Em uma arquitetura Strict RPC, deveríamos ter uma rpc_swap_ticket. 
    // Como somos superadmin usando o service_role, faremos uma transação simulada ou direto no banco.
    try {
      // Pega o bilhete antigo da compra
      const { data: oldTickets } = await supabase.from('raffle_ticket_pool').select('id, ticket_number').eq('purchase_id', purchaseId).limit(1);
      if (!oldTickets || oldTickets.length === 0) return { success: false, message: 'Compra sem bilhetes.' };
      
      const oldTicket = oldTickets[0];
      
      // Checa se o novo número está disponível
      const { data: newTicket } = await supabase.from('raffle_ticket_pool')
        .select('id, status')
        .eq('raffle_id', (await supabase.from('purchases').select('raffle_id').eq('id', purchaseId).single()).data.raffle_id)
        .eq('ticket_number', newNumber)
        .single();
        
      if (!newTicket || newTicket.status !== 'AVAILABLE') return { success: false, message: 'Novo número indisponível.' };
      
      // Swap manual (service role bypasses RLS)
      await supabase.from('raffle_ticket_pool').update({ status: 'AVAILABLE', purchase_id: null, owner_user_id: null }).eq('id', oldTicket.id);
      await supabase.from('raffle_ticket_pool').update({ status: 'PAID', purchase_id: purchaseId, owner_user_id: (await supabase.from('purchases').select('user_id').eq('id', purchaseId).single()).data.user_id }).eq('id', newTicket.id);
      
      return { success: true, message: 'Troca realizada' };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  },

  async updateSimplifyFeeSettings(settings: { depositFeePercent?: number; depositFeeMin?: number; withdrawalFeePercent?: number; withdrawalFeeMin?: number }): Promise<void> {
    const current = await this.getSimplifyFeeSettings();
    const updated = { ...current, ...settings };

    try {
      if (settings.depositFeePercent !== undefined) {
        await supabase.from('app_config').upsert({ key: 'simplify_deposit_fee_percent', value: String(settings.depositFeePercent) });
      }
      if (settings.depositFeeMin !== undefined) {
        await supabase.from('app_config').upsert({ key: 'simplify_deposit_fee_min', value: String(settings.depositFeeMin) });
      }
      if (settings.withdrawalFeePercent !== undefined) {
        await supabase.from('app_config').upsert({ key: 'simplify_withdrawal_fee_percent', value: String(settings.withdrawalFeePercent) });
      }
      if (settings.withdrawalFeeMin !== undefined) {
        await supabase.from('app_config').upsert({ key: 'simplify_withdrawal_fee_min', value: String(settings.withdrawalFeeMin) });
      }
    } catch (e) {
      console.warn('Could not save fee settings to app_config table:', e);
    }
  },
  calculateSimplifyFees(
    val: number,
    feeSettings = { depositFeePercent: 2.5, depositFeeMin: 0.50, withdrawalFeePercent: 2.0, withdrawalFeeMin: 0.50 }
  ) {
    if (val <= 0) {
      return { depositFee: 0, netAfterDeposit: 0, withdrawalFee: 0, totalFees: 0, netRevenue: 0 };
    }

    const calcDeposit = val * (feeSettings.depositFeePercent / 100);
    const depositFee = Math.max(calcDeposit, feeSettings.depositFeeMin);
    const netAfterDeposit = Math.max(0, val - depositFee);

    let withdrawalFee = 0;
    if (netAfterDeposit > 0) {
      const calcWithdrawal = netAfterDeposit * (feeSettings.withdrawalFeePercent / 100);
      withdrawalFee = Math.max(calcWithdrawal, feeSettings.withdrawalFeeMin);
    }

    const netRevenue = Math.max(0, netAfterDeposit - withdrawalFee);
    const totalFees = depositFee + withdrawalFee;

    return {
      depositFee,
      netAfterDeposit,
      withdrawalFee,
      totalFees,
      netRevenue
    };
  },

  async getDashboardStats(startDate?: string | null, endDate?: string | null): Promise<any> {
    const feeSettings = await this.getSimplifyFeeSettings();

    let query = supabase.from('purchases').select('total_value, status, payment_status, created_at, raffle_id, raffles(name)');
    
    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate);

    const { data: purchases, error } = await query;
    if (error) throw error;

    const paid = purchases.filter(p => {
      const paymentStatus = String(p.payment_status || '').toLowerCase();
      const status = String(p.status || '').toLowerCase();
      return paymentStatus === 'paid' || status === 'paid' || status === 'approved';
    });
    const pending = purchases.filter(p => {
      const paymentStatus = String(p.payment_status || '').toLowerCase();
      const status = String(p.status || '').toLowerCase();
      const isPaid = paymentStatus === 'paid' || status === 'paid' || status === 'approved';
      const isCancelled = paymentStatus === 'cancelled' || status === 'cancelled' || status === 'expired' || paymentStatus === 'expired';
      return !isPaid && !isCancelled;
    });

    const totalRevenue = paid.reduce((acc, p) => acc + Number(p.total_value), 0);
    const pendingValue = pending.reduce((acc, p) => acc + Number(p.total_value), 0);

    // Calculate Deposit Fees for each paid purchase
    let totalDepositFees = 0;
    paid.forEach(p => {
      const val = Number(p.total_value);
      if (val > 0) {
        const calcDep = val * (feeSettings.depositFeePercent / 100);
        const depFee = Math.max(calcDep, feeSettings.depositFeeMin);
        totalDepositFees += depFee;
      }
    });

    const totalNetDeposit = Math.max(0, totalRevenue - totalDepositFees);

    // Calculate Withdrawal Fee on the total accumulated net deposit balance
    let totalWithdrawalFees = 0;
    if (totalNetDeposit > 0) {
      const calcWith = totalNetDeposit * (feeSettings.withdrawalFeePercent / 100);
      totalWithdrawalFees = Math.max(calcWith, feeSettings.withdrawalFeeMin);
    }

    const netRevenue = Math.max(0, totalNetDeposit - totalWithdrawalFees);
    const totalSimplifyFees = totalDepositFees + totalWithdrawalFees;

    const { count: activeRaffles } = await supabase
      .from('raffles')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'ACTIVE');

    // Sales by Raffle
    const salesByRaffleMap = new Map();
    paid.forEach(p => {
      const raffleData = p.raffles as any;
      const name = (Array.isArray(raffleData) ? raffleData[0]?.name : raffleData?.name) || 'Desconhecida';
      const current = salesByRaffleMap.get(name) || { gross: 0, depositFees: 0 };
      const val = Number(p.total_value);
      const depFee = val > 0 ? Math.max(val * (feeSettings.depositFeePercent / 100), feeSettings.depositFeeMin) : 0;

      salesByRaffleMap.set(name, {
        gross: current.gross + val,
        depositFees: current.depositFees + depFee
      });
    });

    const salesByRaffle = Array.from(salesByRaffleMap.entries()).map(([name, data]) => {
      const netDep = Math.max(0, data.gross - data.depositFees);
      const withFee = netDep > 0 ? Math.max(netDep * (feeSettings.withdrawalFeePercent / 100), feeSettings.withdrawalFeeMin) : 0;
      const net = Math.max(0, netDep - withFee);
      return {
        name,
        value: data.gross,
        netValue: Number(net.toFixed(2))
      };
    });

    // Chart Data
    const chartDataMap = new Map();
    paid.forEach(p => {
      const date = new Date(p.created_at).toLocaleDateString('pt-BR');
      const val = Number(p.total_value);
      const depFee = val > 0 ? Math.max(val * (feeSettings.depositFeePercent / 100), feeSettings.depositFeeMin) : 0;

      const current = chartDataMap.get(date) || { gross: 0, depositFees: 0 };
      chartDataMap.set(date, {
        gross: current.gross + val,
        depositFees: current.depositFees + depFee
      });
    });

    const chartData = Array.from(chartDataMap.entries()).map(([date, data]) => {
      const netDep = Math.max(0, data.gross - data.depositFees);
      const withFee = netDep > 0 ? Math.max(netDep * (feeSettings.withdrawalFeePercent / 100), feeSettings.withdrawalFeeMin) : 0;
      const net = Math.max(0, netDep - withFee);
      return {
        date,
        value: data.gross,
        netValue: Number(net.toFixed(2)),
        totalFees: Number((data.depositFees + withFee).toFixed(2))
      };
    });

    return {
      totalRevenue,
      netRevenue,
      totalDepositFees,
      totalWithdrawalFees,
      totalSimplifyFees,
      activeRaffles: activeRaffles || 0,
      salesCount: paid.length,
      avgTicket: paid.length > 0 ? totalRevenue / paid.length : 0,
      netAvgTicket: paid.length > 0 ? netRevenue / paid.length : 0,
      pendingCount: pending.length,
      pendingValue,
      salesByRaffle,
      chartData,
      feeSettings
    };
  },

  // --- SUPPORT MESSAGES ---
  async sendSupportMessage(msg: { name: string; email?: string; phone: string; subject?: string; message: string }): Promise<void> {
    const cleanPhone = (msg.phone || '').replace(/\D/g, '');
    try {
      const { error } = await supabase.from('support_messages').insert({
        name: msg.name,
        email: msg.email || null,
        phone: cleanPhone,
        subject: msg.subject || 'Geral',
        message: msg.message,
        created_at: new Date().toISOString()
      });

      if (error) {
        console.error('[SUPPORT] insert failed:', error);
        throw new Error('Nao foi possivel registrar sua mensagem. Tente novamente.');
      }
    } catch (e) {
      console.error("Error sending support message:", e);
      throw e;
    }

  },
  async getSupportMessages(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('support_messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[SUPPORT] read failed:', error);
        return [];
      }
      return data || [];
    } catch (e) {
      console.error('[SUPPORT] read failed:', e);
      return [];
    }

  },
  async resolveSupportMessage(messageId: string, adminEmail: string): Promise<void> {
    try {
      await supabase.from('support_messages').update({ status: 'RESOLVED' }).eq('id', messageId);
      
      await this.logAuditAction(adminEmail, 'SUPORTE_RESOLVIDO', `Marcou mensagem de suporte ID ${messageId} como resolvida`);
    } catch (e) {
      console.error('Error resolving support message:', e);
    }
  },

  // --- SITE SETTINGS & METADATA ---
  async getSiteSettings(): Promise<{ siteTitle: string; siteDescription: string; siteFavicon: string; siteOgImage: string; notificationEnabled: boolean; notificationMin: number; notificationMax: number; brandPrimary: string; brandSecondary: string; siteTheme: string; siteMode: string }> {
    const defaultTitle = 'Nova Plataforma';
    const defaultDesc = 'Sua sorte está aqui! Concorra a prêmios incríveis, carros, motos e Pix com total transparência e entrega garantida. Adquira suas cotas na Nova Plataforma!';

    const { data, error } = await supabase
      .from('app_config')
      .select('key, value')
      .in('key', [
        'site_title', 'site_description', 'site_favicon', 'site_og_image',
        'site_notification_enabled', 'site_notification_min', 'site_notification_max', 'site_brand_primary', 'site_brand_secondary', 'site_theme', 'site_mode'
      ]);

    if (error) {
      console.error('[SITE_SETTINGS] read failed:', error);
    }

    const config: Record<string, string> = {};
    data?.forEach(item => { config[item.key] = item.value; });

    return {
      siteTitle: config['site_title'] || defaultTitle,
      siteDescription: config['site_description'] || defaultDesc,
      siteFavicon: config['site_favicon'] || '',
      siteOgImage: config['site_og_image'] || '',
      notificationEnabled: config['site_notification_enabled'] !== 'false',
      notificationMin: config['site_notification_min'] ? parseInt(config['site_notification_min'], 10) : 20,
      notificationMax: config['site_notification_max'] ? parseInt(config['site_notification_max'], 10) : 500,
      brandPrimary: config['site_brand_primary'] || 'MARCA',
      brandSecondary: config['site_brand_secondary'] || 'NOME',
      siteTheme: config['site_theme'] || 'azure',
      siteMode: config['site_mode'] || 'dark',
    };
  },

  async updateSiteSettings(settings: { siteTitle?: string; siteDescription?: string; siteFavicon?: string; siteOgImage?: string; notificationEnabled?: boolean; notificationMin?: number; notificationMax?: number; brandPrimary?: string; brandSecondary?: string; siteTheme?: string; siteMode?: string }): Promise<void> {
    if (settings.notificationMin !== undefined || settings.notificationMax !== undefined) {
      const min = settings.notificationMin !== undefined ? settings.notificationMin : 0;
      const max = settings.notificationMax !== undefined ? settings.notificationMax : 0;
      if (!Number.isInteger(min) || min < 0) throw new Error('A quantidade mínima deve ser um número inteiro positivo.');
      if (!Number.isInteger(max) || max < 0) throw new Error('A quantidade máxima deve ser um número inteiro positivo.');
      if (settings.notificationMax !== undefined && settings.notificationMin !== undefined && max < min) throw new Error('A quantidade máxima não pode ser menor que a quantidade mínima.');
    }

    const map: Array<[string, string | undefined]> = [
      ['site_title', settings.siteTitle],
      ['site_description', settings.siteDescription],
      ['site_favicon', settings.siteFavicon],
      ['site_og_image', settings.siteOgImage],
      ['site_notification_enabled', settings.notificationEnabled !== undefined ? String(settings.notificationEnabled) : undefined],
      ['site_notification_min', settings.notificationMin !== undefined ? String(settings.notificationMin) : undefined],
      ['site_notification_max', settings.notificationMax !== undefined ? String(settings.notificationMax) : undefined],
      ['site_brand_primary', settings.brandPrimary],
      ['site_brand_secondary', settings.brandSecondary],
      ['site_theme', settings.siteTheme],
      ['site_mode', settings.siteMode],
    ];

    const rows = map
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => ({ key, value: String(value) }));

    if (rows.length === 0) return;

    const { error } = await supabase.from('app_config').upsert(rows, { onConflict: 'key' });

    if (error) {
      console.error('[SITE_SETTINGS] save failed:', error);
      throw new Error(`Não foi possível salvar as configurações do site: ${error.message}`);
    }
  },

  async getSimplifyFeeSettings(): Promise<any> {
    let depositFeePercent = 2.50;
    let depositFeeMin = 0.50;
    let withdrawalFeePercent = 2.00;
    let withdrawalFeeMin = 0.50;

    try {
      const { data, error } = await supabase.from('app_config').select('key, value').like('key', 'simplify_%');
      if (!error && data) {
        data.forEach(row => {
          if (row.key === 'simplify_deposit_fee_percent') depositFeePercent = parseFloat(row.value);
          if (row.key === 'simplify_deposit_fee_min') depositFeeMin = parseFloat(row.value);
          if (row.key === 'simplify_withdrawal_fee_percent') withdrawalFeePercent = parseFloat(row.value);
          if (row.key === 'simplify_withdrawal_fee_min') withdrawalFeeMin = parseFloat(row.value);
        });
      }
    } catch (e) {
      console.warn("Could not load fee settings from db");
    }

    return { depositFeePercent, depositFeeMin, withdrawalFeePercent, withdrawalFeeMin };
  },

  async getBanners(): Promise<any[]> {
    const { data, error } = await supabase.from('banners').select('*').order('created_at', { ascending: false });
    if (error) {
        console.warn('Erro ao carregar banners', error);
        return [];
    }
    return data || [];
  },

  async adminGetBanners(): Promise<any[]> {
    return this.getBanners();
  },

  async adminCreateBanner(imageUrl: string): Promise<any> {
    const { data, error } = await supabase.from('banners').insert([{ image_url: imageUrl }]).select().single();
    if (error) throw error;
    return data;
  },

  /**
   * Exclui o banner e o arquivo correspondente no Storage.
   *
   * Antes só o registro saía do banco; o arquivo continuava publicado. Hoje há
   * pelo menos um banner cujo arquivo foi removido à mão e cuja URL responde
   * 400 — o inverso do mesmo descompasso.
   */
  async adminDeleteBanner(id: string): Promise<void> {
    const { data: banner } = await supabase
      .from('banners')
      .select('image_url')
      .eq('id', id)
      .maybeSingle();

    const { error } = await supabase.from('banners').delete().eq('id', id);
    if (error) throw error;

    if (banner?.image_url) await deleteStorageObject(banner.image_url);
  },

  async createRaffle(data: Partial<Raffle>) {
      const payload = {
          name: data.name,
          description: data.description,
          full_description: data.fullDescription,
          image_url: data.imageUrl,
          total_numbers: data.totalNumbers,
          price_per_number: data.pricePerNumber,
          min_purchase: data.minPurchase || 1,
          fake_sold_count: data.fakeSoldNumbers || 0,
          status: 'ACTIVE',
          draw_date: data.drawDate || null,
          ranking_start_date: data.rankingStartDate || null,
          ranking_end_date: data.rankingEndDate || null,
          security_margin_percent: data.securityMarginPercent || 0,
          show_promo_banner: data.showPromoBanner ?? true,
          promo_banner_title: data.promoBannerTitle || null,
          promo_banner_subtitle: data.promoBannerSubtitle || null,
          show_ranking: data.showRanking ?? true,
          terms_and_rules: data.termsAndRules || null,
          is_featured: data.isFeatured ?? false,
          ranking_config: data.rankingConfig || [],
          manual_ranking: data.manualRanking || [],
      };
      
      const { data: created, error } = await supabase.from('raffles').insert(payload).select().single();
      
      if (error) {
          console.error("Erro ao criar rifa:", error);
          throw error;
      }

      /**
       * Generate the ticket pool.
       *
       * This error used to be logged and swallowed, so a raffle could be
       * created with total_numbers set but zero rows in raffle_ticket_pool.
       * The admin saw "success", the storefront showed the cotas as available
       * (that count reads raffles.total_numbers), and every purchase then failed
       * at reservation time because there were no actual tickets to hand out.
       *
       * The raffle is removed again so a failure cannot leave that state behind.
       */
      const { error: poolErr } = await supabase.rpc('rpc_create_raffle_pool', { p_raffle_id: created.id });
      if (poolErr) {
          console.error('[CREATE_RAFFLE] pool generation failed, rolling back raffle:', poolErr);
          await supabase.from('raffles').delete().eq('id', created.id);
          throw new Error(`Não foi possível gerar as cotas da rifa: ${poolErr.message}`);
      }

      const { count } = await supabase
          .from('raffle_ticket_pool')
          .select('*', { count: 'exact', head: true })
          .eq('raffle_id', created.id);

      if ((count ?? 0) !== Number(payload.total_numbers)) {
          console.error(`[CREATE_RAFFLE] pool size mismatch: expected ${payload.total_numbers}, got ${count}`);
          await supabase.from('raffle_ticket_pool').delete().eq('raffle_id', created.id);
          await supabase.from('raffles').delete().eq('id', created.id);
          throw new Error('As cotas da rifa não foram geradas corretamente. Nenhuma alteração foi salva.');
      }

      return created;
  },

  async updateRaffle(id: string, updates: any) {
     const dbUpdates = {
          name: updates.name,
          description: updates.description,
          full_description: updates.fullDescription,
          image_url: updates.imageUrl,
          total_numbers: updates.totalNumbers,
          price_per_number: updates.pricePerNumber,
          min_purchase: updates.minPurchase,
          fake_sold_count: updates.fakeSoldNumbers,
          status: updates.status,
          draw_date: updates.drawDate,
          ranking_start_date: updates.rankingStartDate,
          ranking_end_date: updates.rankingEndDate,
          security_margin_percent: updates.securityMarginPercent,
          show_promo_banner: updates.showPromoBanner,
          promo_banner_title: updates.promoBannerTitle,
          promo_banner_subtitle: updates.promoBannerSubtitle,
          show_ranking: updates.showRanking,
          terms_and_rules: updates.termsAndRules,
          is_featured: updates.isFeatured,
          ranking_config: updates.rankingConfig,
          manual_ranking: updates.manualRanking,
     };
     
     // Remove undefined properties
     Object.keys(dbUpdates).forEach(key => dbUpdates[key] === undefined && delete dbUpdates[key]);

     const { error } = await supabase.from('raffles').update(dbUpdates).eq('id', id);
     if (error) {
         console.error("Erro ao atualizar rifa:", error);
         throw error;
     }

  },
  /**
   * Exclui a rifa e o arquivo de imagem dela.
   *
   * As tabelas dependentes (raffle_ticket_pool, purchases, winning_tickets,
   * winners) saem por CASCADE, mas o arquivo no Storage não — ele ficava órfão
   * consumindo espaço para sempre.
   *
   * A remoção do arquivo era feita no navegador com a chave anon, e sem
   * `catch` no AdminPanel: qualquer falha ali abortava a exclusão da rifa
   * antes mesmo de chamar a API. Fazendo no servidor, a exclusão do registro
   * nunca depende de permissão de Storage no cliente.
   */
  async deleteRaffle(id: string) {
     const { data: raffle } = await supabase
       .from('raffles')
       .select('image_url')
       .eq('id', id)
       .maybeSingle();

     const { error } = await supabase.from('raffles').delete().eq('id', id);
     if (error) throw error;

     // Depois da exclusão bem-sucedida: um arquivo órfão é melhor que uma
     // imagem apagada de uma rifa que continuou existindo.
     if (raffle?.image_url) await deleteStorageObject(raffle.image_url);
  },
  async adminCreateWinningTicket(raffleId: string, ticketNumber: number, prizeDescription: string) {
      const { error } = await supabase.from('winning_tickets').insert({
          raffle_id: raffleId,
          ticket_number: ticketNumber,
          prize_description: prizeDescription,
          is_active: true,
          won: false
      });
      if (error) throw error;
  },
  async getPublicWinningTickets(raffleId: string): Promise<any[]> {
      const { data, error } = await supabase.from('winning_tickets').select('id, raffle_id, ticket_number, prize_description, is_active, won').eq('raffle_id', raffleId);
      if (error) return [];
      return data.map((wt: any) => ({
          id: wt.id,
          raffleId: wt.raffle_id,
          ticketNumber: wt.ticket_number,
          prizeDescription: wt.prize_description,
          isActive: wt.is_active,
          won: wt.won
      }));
  },

  async adminGetWinningTickets(raffleId: string): Promise<any[]> {
      const { data, error } = await supabase.from('winning_tickets').select('*').eq('raffle_id', raffleId);
      if (error) return [];
      return data.map((wt: any) => ({
          id: wt.id,
          raffleId: wt.raffle_id,
          ticketNumber: wt.ticket_number,
          prizeDescription: wt.prize_description,
          isActive: wt.is_active,
          won: wt.won,
          winnerName: wt.winner_name,
          winnerPhone: wt.winner_phone,
          winnerCpf: wt.winner_cpf
      }));
  },

  async getWinningTickets(raffleId: string): Promise<any[]> {
      // Used internally by create logic in AdminPanel
      return this.adminGetWinningTickets(raffleId);
  },

  async adminToggleWinningTicket(id: string, isActive: boolean) {
      const { error } = await supabase.from('winning_tickets').update({ is_active: isActive }).eq('id', id);
      if (error) throw error;
  },

  async adminDeleteWinningTicket(id: string) {
      const { error } = await supabase.from('winning_tickets').delete().eq('id', id);
      if (error) throw error;
  },
  
  /**
   * Nomeia o ganhador de um bilhete premiado.
   *
   * A tabela winning_tickets nao possui colunas winner_phone / winner_cpf — a
   * versao anterior tentava grava-las e a operacao falhava inteira com
   * "Could not find the 'winner_cpf' column of 'winning_tickets'".
   *
   * Telefone e CPF ja pertencem ao cadastro do comprador, entao o CPF e usado
   * para vincular o perfil (user_id) em vez de duplicar dado pessoal aqui.
   */
  async adminAssignWinningTicket(id: string, winnerName: string, winnerPhone: string, winnerCpf: string) {
      const cleanCpf = String(winnerCpf || '').replace(/\D/g, '');

      let userId: string | null = null;
      if (cleanCpf.length === 11) {
          const { data: profile } = await supabase
              .from('profiles')
              .select('id')
              .eq('cpf', cleanCpf)
              .maybeSingle();
          userId = profile?.id ?? null;
      }

      const { error } = await supabase.from('winning_tickets').update({
          won: true,
          winner_name: winnerName,
          user_id: userId
      }).eq('id', id);
      if (error) throw error;

      // O telefone vem do formulario mas nao tem coluna aqui; fica no perfil.
      void winnerPhone;
  },

  // ===================================================================
  //  ADMIN OPERATIONS
  //
  //  These were called by AdminPanel / AdminSimulation / SuperAdminPanel but
  //  had no implementation on either service, so every one of these screens
  //  failed with "Invalid action" coming back from /api/admin/rpc.
  // ===================================================================

  /** Audit trail. `includeHidden` is only honoured for super admins. */
  async getAuditLogs(includeHidden: boolean = false): Promise<any[]> {
    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (!includeHidden) {
      query = query.eq('is_hidden', false);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[AUDIT] read failed:', error);
      return [];
    }
    return data || [];
  },

  /**
   * Records an administrative action. Deliberately never throws: a failure to
   * write the log must not abort the operation being logged.
   */
  async logAuditAction(adminEmail: string, actionType: string, details: string): Promise<void> {
    const { error } = await supabase.from('audit_logs').insert({
      admin_email: adminEmail || 'desconhecido',
      action_type: actionType,
      details,
      is_hidden: false,
      hidden_from_admins: false,
    });
    if (error) console.error('[AUDIT] write failed:', error);
  },

  /**
   * Base de leads do CRM.
   *
   * O formato precisa bater exatamente com o que a tabela do painel lê:
   * `name`, `purchaseCount`, `pendingCount`, `status` e `totalSpent`. A versão
   * anterior devolvia `full_name` / `totalOrders` e não calculava status, então
   * todas as linhas apareciam como "Sem nome", sem contadores e sem
   * classificação — e o filtro por status não encontrava nada.
   *
   * Classificação:
   *   VIP     — pagou 3 compras ou mais, ou mais de R$ 500 no total
   *   CLIENTE — já pagou pelo menos uma vez
   *   QUENTE  — tem compra pendente, nunca pagou (tentou e parou no PIX)
   *   FRIO    — cadastrado, sem nenhuma compra
   */
  async getUsersCRM(): Promise<any[]> {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, full_name, cpf, phone, role, created_at')
      .order('created_at', { ascending: false })
      .limit(5000);

    if (error) {
      console.error('[CRM] read failed:', error);
      return [];
    }

    const { data: purchases } = await supabase
      .from('purchases')
      .select('user_id, quantity, total_value, status, payment_status');

    type Totals = { tickets: number; spent: number; paid: number; pending: number };
    const totals = new Map<string, Totals>();

    (purchases || []).forEach(p => {
      if (!p.user_id) return;
      const cur = totals.get(p.user_id) || { tickets: 0, spent: 0, paid: 0, pending: 0 };

      // Duas convenções de status convivem no banco ('paid' e 'PAID'), então a
      // comparação é sempre em minúsculas.
      const paymentStatus = String(p.payment_status || '').toLowerCase();
      const status = String(p.status || '').toLowerCase();
      const isPaid = paymentStatus === 'paid' || status === 'paid' || status === 'approved';
      const isCancelled = paymentStatus === 'cancelled' || status === 'cancelled' || status === 'expired' || paymentStatus === 'expired';

      if (isPaid) {
        cur.paid += 1;
        cur.tickets += Number(p.quantity) || 0;
        cur.spent += Number(p.total_value) || 0;
      } else if (!isCancelled) {
        cur.pending += 1;
      }

      totals.set(p.user_id, cur);
    });

    return (profiles || []).map(p => {
      const t = totals.get(p.id) || { tickets: 0, spent: 0, paid: 0, pending: 0 };

      let status: 'VIP' | 'CLIENTE' | 'QUENTE' | 'FRIO';
      if (t.paid >= 3 || t.spent > 500) status = 'VIP';
      else if (t.paid > 0) status = 'CLIENTE';
      else if (t.pending > 0) status = 'QUENTE';
      else status = 'FRIO';

      return {
        id: p.id,
        name: p.full_name || '',
        full_name: p.full_name || '',
        cpf: p.cpf || '',
        phone: p.phone || '',
                                role: p.role,
        createdAt: p.created_at,
        status,
        purchaseCount: t.paid + t.pending,
        pendingCount: t.pending,
        paidCount: t.paid,
        totalTickets: t.tickets,
        totalSpent: t.spent,
      };
    });
  },

  /** Every purchase, with buyer and raffle joined in, for the sales tab. */
  async adminGetAllPurchases(limit: number = 5000): Promise<any[]> {
    const { data, error } = await supabase
      .from('purchases')
      .select('*, profiles(id, full_name, cpf, phone), raffles(id, name)')
      .order('created_at', { ascending: false })
      .limit(Math.min(Number(limit) || 5000, 5000));

    if (error) {
      console.error('[PURCHASES] read failed:', error);
      return [];
    }

    return (data || []).map((p: any) => ({
      ...p,
      name: p.profiles?.full_name || null,
      cpf: p.profiles?.cpf || null,
      phone: p.profiles?.phone || null,
      raffleName: p.raffles?.name || null,
      purchase_date: p.created_at,
    }));
  },

  /**
   * Edits a purchase from the admin panel.
   *
   * The form mixes order fields with buyer fields, so each half is routed to
   * the table that actually owns it: `purchase_date` maps to
   * `purchases.created_at`, while name/phone/cpf belong to the buyer profile.
   */
  async adminUpdatePurchase(
    purchaseId: string,
    updates: { purchase_date?: string; name?: string; phone?: string; cpf?: string; status?: string }
  ): Promise<void> {
    const purchaseUpdates: Record<string, any> = {};
    if (updates.purchase_date) purchaseUpdates.created_at = updates.purchase_date;
    if (updates.status) purchaseUpdates.status = updates.status;

    if (Object.keys(purchaseUpdates).length > 0) {
      const { error } = await supabase.from('purchases').update(purchaseUpdates).eq('id', purchaseId);
      if (error) throw new Error(`Não foi possível atualizar a compra: ${error.message}`);
    }

    const profileUpdates: Record<string, any> = {};
    if (updates.name !== undefined) profileUpdates.full_name = updates.name;
    if (updates.phone !== undefined) profileUpdates.phone = String(updates.phone).replace(/\D/g, '');
    if (updates.cpf !== undefined) profileUpdates.cpf = String(updates.cpf).replace(/\D/g, '');

    if (Object.keys(profileUpdates).length > 0) {
      const { data: purchase } = await supabase
        .from('purchases')
        .select('user_id')
        .eq('id', purchaseId)
        .maybeSingle();

      if (purchase?.user_id) {
        const { error } = await supabase.from('profiles').update(profileUpdates).eq('id', purchase.user_id);
        if (error) throw new Error(`Não foi possível atualizar o comprador: ${error.message}`);
      }
    }
  },

  /** Manual approval: reuses the transactional path the payment webhook uses. */
  async approvePurchase(purchaseId: string): Promise<{ success: boolean; error?: string }> {
    return this.confirmPaymentAndReleaseTickets(purchaseId);
  },

  /** Ticket numbers belonging to one purchase. */
  async adminGetTicketsByPurchase(purchaseId: string): Promise<number[]> {
    const { data, error } = await supabase
      .from('raffle_ticket_pool')
      .select('ticket_number')
      .eq('purchase_id', purchaseId)
      .order('ticket_number', { ascending: true });

    if (error) {
      console.error('[TICKETS] read failed:', error);
      return [];
    }
    return (data || []).map(t => t.ticket_number);
  },

  /**
   * Returns every reserved ticket of a raffle to the pool.
   *
   * Destructive, so it refuses to run while the raffle still has confirmed
   * payments: releasing those would take cotas away from customers who paid.
   */
  async adminClearRaffleTickets(raffleId: string): Promise<{ success: boolean; released: number }> {
    const { count: paidCount } = await supabase
      .from('raffle_ticket_pool')
      .select('*', { count: 'exact', head: true })
      .eq('raffle_id', raffleId)
      .eq('status', 'PAID');

    if ((paidCount ?? 0) > 0) {
      throw new Error(
        `Esta rifa possui ${paidCount} cota(s) já paga(s). Limpar os bilhetes removeria cotas de clientes que pagaram.`
      );
    }

    const { count: reservedCount } = await supabase
      .from('raffle_ticket_pool')
      .select('*', { count: 'exact', head: true })
      .eq('raffle_id', raffleId)
      .eq('status', 'RESERVED');

    const { error } = await supabase
      .from('raffle_ticket_pool')
      .update({ status: 'AVAILABLE', purchase_id: null, owner_user_id: null, reserved_at: null })
      .eq('raffle_id', raffleId)
      .eq('status', 'RESERVED');

    if (error) throw new Error(`Não foi possível liberar as cotas: ${error.message}`);

    await supabase
      .from('purchases')
      .update({ status: 'cancelled', payment_status: 'cancelled' })
      .eq('raffle_id', raffleId)
      .eq('payment_status', 'pending');

    return { success: true, released: reservedCount ?? 0 };
  },

  /** Who bought a given ticket number. Returns a Supabase-style { data, error }. */
  async getTicketOwner(
    raffleId: string,
    ticketNumber: number
  ): Promise<{ data: any | null; error: string | null }> {
    const { data: ticket, error } = await supabase
      .from('raffle_ticket_pool')
      .select('id, ticket_number, status, purchase_id, owner_user_id')
      .eq('raffle_id', raffleId)
      .eq('ticket_number', ticketNumber)
      .maybeSingle();

    if (error) return { data: null, error: error.message };
    if (!ticket || !ticket.purchase_id) return { data: null, error: null };

    const { data: purchase } = await supabase
      .from('purchases')
      .select('id, created_at, quantity, total_value, status, payment_status, user_id')
      .eq('id', ticket.purchase_id)
      .maybeSingle();

    let profile: any = null;
    if (purchase?.user_id) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('id, full_name, cpf, phone')
        .eq('id', purchase.user_id)
        .maybeSingle();
      profile = prof;
    }

    return {
      data: {
        ticket_number: ticket.ticket_number,
        status: ticket.status,
        purchase_id: ticket.purchase_id,
        userId: purchase?.user_id || null,
        name: profile?.full_name || null,
        cpf: profile?.cpf || null,
        phone: profile?.phone || null,
                purchaseDate: purchase?.created_at || null,
        quantity: purchase?.quantity || 0,
      },
      error: null,
    };
  },

  /** Looks a CPF up before assigning a ticket to it. */
  async checkCpfInfo(
    cpf: string,
    raffleId?: string
  ): Promise<{
    exists: boolean;
    name?: string;
    phone?: string;
    userId?: string;
    hasPurchaseInRaffle: boolean;
  }> {
    const cleanCpf = String(cpf || '').replace(/\D/g, '');
    if (cleanCpf.length !== 11) throw new Error('CPF inválido.');

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, phone')
      .eq('cpf', cleanCpf)
      .maybeSingle();

    if (!profile) return { exists: false, hasPurchaseInRaffle: false };

    let hasPurchaseInRaffle = false;
    if (raffleId) {
      const { count } = await supabase
        .from('purchases')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('raffle_id', raffleId);
      hasPurchaseInRaffle = (count ?? 0) > 0;
    }

    return {
      exists: true,
      name: profile.full_name,
      phone: profile.phone,
      userId: profile.id,
      hasPurchaseInRaffle,
    };
  },

  /**
   * Assigns an existing ticket to a person, creating the profile when the CPF
   * is not registered yet. Used for sales taken outside the site.
   */
  async adminProcessTicketAssignment(
    raffleId: string,
    ticketNumber: number,
    cpf: string,
    name: string,
    phone: string,
    purchaseDate?: string
  ): Promise<{ success: boolean; purchaseId: string }> {
    const cleanCpf = String(cpf || '').replace(/\D/g, '');
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    if (cleanCpf.length !== 11) throw new Error('CPF inválido.');
    if (!name || !name.trim()) throw new Error('Nome é obrigatório.');

    const { data: ticket } = await supabase
      .from('raffle_ticket_pool')
      .select('id, status, purchase_id')
      .eq('raffle_id', raffleId)
      .eq('ticket_number', ticketNumber)
      .maybeSingle();

    if (!ticket) throw new Error(`Bilhete ${ticketNumber} não existe nesta rifa.`);
    if (ticket.status === 'PAID') {
      throw new Error(`Bilhete ${ticketNumber} já pertence a outro comprador.`);
    }

    let userId: string;
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('cpf', cleanCpf)
      .maybeSingle();

    if (existing) {
      userId = existing.id;
      await supabase
        .from('profiles')
        .update({ full_name: name.trim(), phone: cleanPhone })
        .eq('id', userId);
    } else {
      const { data: created, error: cErr } = await supabase
        .from('profiles')
        .insert({ full_name: name.trim(), cpf: cleanCpf, phone: cleanPhone, role: 'user' })
        .select('id')
        .single();
      if (cErr || !created) throw new Error(`Não foi possível criar o cadastro: ${cErr?.message}`);
      userId = created.id;
    }

    const { data: raffle } = await supabase
      .from('raffles')
      .select('price_per_number')
      .eq('id', raffleId)
      .maybeSingle();

    const price = Number(raffle?.price_per_number) || 0;

    const { data: purchase, error: pErr } = await supabase
      .from('purchases')
      .insert({
        user_id: userId,
        raffle_id: raffleId,
        quantity: 1,
        total_value: price,
        ticket_price: price,
        status: 'paid',
        payment_status: 'paid',
        source: 'manual',
        created_at: purchaseDate || new Date().toISOString(),
      })
      .select('id')
      .single();

    if (pErr || !purchase) throw new Error(`Não foi possível registrar a compra: ${pErr?.message}`);

    const { error: tErr } = await supabase
      .from('raffle_ticket_pool')
      .update({
        status: 'PAID',
        purchase_id: purchase.id,
        owner_user_id: userId,
        paid_at: new Date().toISOString(),
      })
      .eq('id', ticket.id);

    if (tErr) throw new Error(`Não foi possível atribuir o bilhete: ${tErr.message}`);

    return { success: true, purchaseId: purchase.id };
  },

  /** Names the holder of a pre-registered winning ticket. */
  async adminManualAssignWinner(
    winningTicketId: string,
    raffleId: string,
    ticketNumber: number,
    name: string,
    cpf: string,
    phone: string,
    imageUrl?: string
  ): Promise<{ success: boolean }> {
    if (!name || !name.trim()) throw new Error('Nome do ganhador é obrigatório.');

    const cleanCpf = String(cpf || '').replace(/\D/g, '');

    let userId: string | null = null;
    if (cleanCpf.length === 11) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('cpf', cleanCpf)
        .maybeSingle();
      userId = profile?.id ?? null;
    }

    const { data: wt, error: wtError } = await supabase
      .from('winning_tickets')
      .update({
        won: true,
        winner_name: name.trim(),
        user_id: userId,
        is_active: true,
      })
      .eq('id', winningTicketId)
      .select('prize_description')
      .single();

    if (wtError || !wt) throw new Error(`Não foi possível atribuir o ganhador: ${wtError?.message}`);

    await supabase
      .from('raffle_ticket_pool')
      .update({ is_winner: true })
      .eq('raffle_id', raffleId)
      .eq('ticket_number', ticketNumber);

    await supabase
      .from('winners')
      .upsert({
        raffle_id: raffleId,
        user_id: userId,
        winner_name: userId ? null : name.trim(),
        winner_phone: userId ? null : phone,
        ticket_number: ticketNumber,
        prize: wt.prize_description,
        prize_type: 'bilhete',
        image_url: imageUrl || null,
        draw_date: new Date().toISOString()
      }, {
        onConflict: 'raffle_id,ticket_number,prize_type'
      });

    return { success: true };
  },

  /** Publishes a winner on the public winners page. */
  async adminRegisterWinner(payload: {
    raffleId: string;
    userId?: string | null;
    ticketNumber: number;
    prizeDescription: string;
    prizeType?: string;
    prizeValue?: number | null;
    imageUrl?: string | null;
    drawDate?: string;
    isManual?: boolean;
    winnerName?: string;
    winnerPhone?: string;
  }): Promise<{ success: boolean; id?: string }> {
    if (!payload?.raffleId) throw new Error('Rifa não informada.');
    if (!payload.prizeDescription) throw new Error('Descrição do prêmio é obrigatória.');

    if (!payload.isManual && payload.prizeType !== 'ranking') {
      // Validations to ensure ticket is PAID and not already a winner
      const { data: ticket, error: ticketErr } = await supabase
        .from('raffle_ticket_pool')
        .select('status, is_winner, owner_user_id')
        .eq('raffle_id', payload.raffleId)
        .eq('ticket_number', payload.ticketNumber)
        .maybeSingle();

      if (ticketErr || !ticket) {
        throw new Error('Bilhete não encontrado nesta rifa.');
      }
      if (ticket.status !== 'PAID') {
        throw new Error('Este bilhete ainda não possui pagamento confirmado e não pode ser registrado como vencedor.');
      }
    }

    const { data, error } = await supabase
      .from('winners')
      .upsert({
        raffle_id: payload.raffleId,
        user_id: payload.userId || null,
        winner_name: payload.userId ? null : payload.winnerName?.trim() || null,
        winner_phone: payload.userId ? null : payload.winnerPhone?.trim() || null,
        ticket_number: payload.ticketNumber,
        prize: payload.prizeDescription,
        prize_type: payload.prizeType || 'rifa',
        prize_value: payload.prizeValue ?? null,
        image_url: payload.imageUrl || null,
        draw_date: payload.drawDate || new Date().toISOString(),
      }, {
        onConflict: 'raffle_id,ticket_number,prize_type'
      })
      .select('id')
      .maybeSingle();

    if (error) throw new Error(`Não foi possível registrar o ganhador: ${error?.message}`);

    if (payload.prizeType !== 'ranking') {
        await supabase
          .from('raffle_ticket_pool')
          .update({ is_winner: true, drawn_at: new Date().toISOString() })
          .eq('raffle_id', payload.raffleId)
          .eq('ticket_number', payload.ticketNumber);
          
        if (payload.prizeType === 'rifa') {
            await supabase
              .from('raffles')
              .update({ 
                status: 'FINISHED', 
                winner_number: payload.ticketNumber,
                winner_name: payload.winnerName 
              })
              .eq('id', payload.raffleId);
        }
    }

    return { success: true, id: data?.id };
  },

  async adminGetWinners() {
    const { data, error } = await supabase
      .from('winners')
      .select('*, profiles(full_name, cpf, phone), raffles(name)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async adminUpdateWinnerDeliveryStatus(winnerId: string, status: string) {
    const { error } = await supabase
      .from('winners')
      .update({ delivery_status: status })
      .eq('id', winnerId);
    if (error) throw error;
    return { success: true };
  },

  async adminGetPurchaseByTicket(raffleId: string, ticketNumber: number) {
    const { data: ticket, error: ticketError } = await supabase
      .from('raffle_ticket_pool')
      .select('purchase_id')
      .eq('raffle_id', raffleId)
      .eq('ticket_number', ticketNumber)
      .maybeSingle();
      
    if (ticketError || !ticket || !ticket.purchase_id) throw new Error('Compra não encontrada para este bilhete.');

    const { data: purchaseData, error: purchaseError } = await supabase
      .from('purchases')
      .select('*, profiles(full_name, phone), raffles(name)')
      .eq('id', ticket.purchase_id)
      .single();

    if (purchaseError) throw purchaseError;

    const { data: allTickets } = await supabase
      .from('raffle_ticket_pool')
      .select('ticket_number')
      .eq('purchase_id', ticket.purchase_id);

    return {
       info: {
         name: purchaseData.profiles?.full_name || purchaseData.name || 'Desconhecido',
         phone: purchaseData.profiles?.phone || purchaseData.phone || '',
         raffles: { name: purchaseData.raffles?.name || 'Rifa' }
       },
       numbers: allTickets?.map(t => t.ticket_number).sort((a,b) => a-b) || []
    };
  },

  /**
   * Top buyers of a raffle, respeitando a janela do ciclo.
   *
   * Duas coisas estavam erradas aqui:
   *
   * 1. O frontend lia uma tabela `raffle_ranking` que não existe neste banco,
   *    então o ranking vinha sempre vazio. É derivado das cotas efetivamente
   *    pagas.
   * 2. `ranking_start_date` / `ranking_end_date` eram gravados e devolvidos ao
   *    formulário, mas nada no sistema comparava com a hora atual. O ranking
   *    nunca encerrava e somava cotas de qualquer época. Agora só contam as
   *    cotas pagas dentro da janela configurada.
   */
  async getRaffleRanking(raffleId: string, maxPosition: number = 100): Promise<any[]> {
    const { data: ranking, error } = await supabase.rpc('get_raffle_ranking', {
      p_raffle_id: raffleId,
      p_max_position: maxPosition || 100
    });

    if (error) {
      console.error('[RANKING] read failed:', error);
      return [];
    }

    return (ranking || []).map((row: any, index: number) => ({
      position: index + 1,
      ranking: index + 1,
      raffle_id: raffleId,
      user_id: row.user_id,
      name: row.name || 'Comprador',
      phone: row.phone || null,
      total_tickets: Number(row.total_tickets),
      totalTickets: Number(row.total_tickets),
    }));
  },

  /** Closes a ranking cycle, archiving the current leader into ranking_history. */
  async finalizeRankingCycle(raffleId: string, topBuyer?: any): Promise<{ success: boolean }> {
    let leader = topBuyer;
    if (!leader) {
      const ranking = await this.getRaffleRanking(raffleId, 1);
      leader = ranking[0];
    }
    if (!leader) throw new Error('Não há comprador no ranking para encerrar o ciclo.');

    const { data: raffle } = await supabase
      .from('raffles')
      .select('ranking_config')
      .eq('id', raffleId)
      .maybeSingle();

    const prize = Array.isArray(raffle?.ranking_config) ? raffle?.ranking_config?.[0]?.prize : null;

    const { error } = await supabase.from('ranking_history').insert({
      raffle_id: raffleId,
      winner_name: leader.name || leader.winner_name || 'Comprador',
      winner_phone: leader.phone || leader.winner_phone || null,
      total_tickets: leader.total_tickets || 0,
      prize: prize || 'Prêmio do ranking',
      cycle_end_date: new Date().toISOString(),
    });

    if (error) throw new Error(`Não foi possível encerrar o ciclo: ${error.message}`);
    return { success: true };
  },

  /** Available ticket numbers, used by the draw simulator. */
  async getSimulationNumbers(raffleId: string): Promise<number[]> {
    const { data, error } = await supabase
      .from('raffle_ticket_pool')
      .select('ticket_number')
      .eq('raffle_id', raffleId)
      .eq('status', 'AVAILABLE')
      .order('random_order', { ascending: true })
      .limit(10000);

    if (error) {
      console.error('[SIMULATION] read failed:', error);
      return [];
    }
    return (data || []).map(t => t.ticket_number);
  },

  /** Hides or shows a raffle from the regular admin view (super admin only). */
  async superAdminToggleShadowMode(raffleId: string, enabled: boolean): Promise<{ success: boolean }> {
    const { error } = await supabase
      .from('raffles')
      .update({ is_hidden_from_admin: enabled })
      .eq('id', raffleId);

    if (error) throw new Error(`Não foi possível alterar o modo sombra: ${error.message}`);
    return { success: true };
  },
  // ----------------------------------------------------------------------
  // META PIXELS (Admin)
  // ----------------------------------------------------------------------

  async adminGetMetaPixels(): Promise<any[]> {
    const { data, error } = await supabase
      .from('meta_pixels')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Erro ao buscar Meta Pixels: ${error.message}`);
    return data || [];
  },

  async adminCreateMetaPixel(pixel_id: string): Promise<any> {
    const { data, error } = await supabase
      .from('meta_pixels')
      .insert([{ pixel_id, is_active: true }])
      .select()
      .single();
    if (error) throw new Error(`Erro ao criar Meta Pixel: ${error.message}`);
    return data;
  },

  async adminToggleMetaPixel(id: string, is_active: boolean): Promise<{ success: boolean }> {
    const { error } = await supabase
      .from('meta_pixels')
      .update({ is_active })
      .eq('id', id);
    if (error) throw new Error(`Erro ao atualizar Meta Pixel: ${error.message}`);
    return { success: true };
  },

  async adminDeleteMetaPixel(id: string): Promise<{ success: boolean }> {
    const { error } = await supabase
      .from('meta_pixels')
      .delete()
      .eq('id', id);
    if (error) throw new Error(`Erro ao excluir Meta Pixel: ${error.message}`);
    return { success: true };
  }
};
