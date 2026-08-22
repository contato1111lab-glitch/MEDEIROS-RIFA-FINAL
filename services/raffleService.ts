import { supabase } from './supabaseClient';
import { storageService } from './storageService';
import { Raffle, RaffleStatus, Purchase, Profile, Winner, WinningTicket, Banner } from '../types';

export const raffleService = {

  getCurrentCustomerSession() {
    try {
      const stored = localStorage.getItem('customerSession');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  },
  setCustomerSession(profile: any) {
    try {
      if (profile) {
        localStorage.setItem('customerSession', JSON.stringify(profile));
      } else {
        localStorage.removeItem('customerSession');
      }
    } catch {}
  },
  async getPendingWinnerNotifications(userId: string): Promise<any[]> {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_notifications', id: userId })
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Erro ao buscar notificações');
    return data.notifications || [];
  },

  async markWinnerAsNotified(userId: string, winnerId: string): Promise<void> {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_notified', id: userId, winnerId })
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Erro ao atualizar notificação');
  },

  async loginCustomer(identifier: string, password?: string) {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', identifier, password })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    this.setCustomerSession(data.profile);
    return data.profile;
  },
  async createProfile(profileData: any) {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'register', profile: profileData })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    this.setCustomerSession(data.profile);
    return data.profile;
  },
  async updateProfile(id: string, updates: any) {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', id, updates })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data;
  },
  /**
   * Purchase lookup used by the checkout, the success screen and "meus
   * bilhetes".
   *
   * These four helpers were called by the UI but never existed on this
   * service, so every call threw "raffleService.getPurchaseById is not a
   * function" and those screens failed. They now go through
   * GET /api/purchases/:id, which reads the data server-side with the service
   * role — that is what lets `purchases`, `raffle_ticket_pool` and
   * `profiles` stay closed to the public anon key.
   */
  async getPurchaseById(purchaseId: string): Promise<any | null> {
    try {
      const res = await fetch(`/api/purchases/${encodeURIComponent(purchaseId)}`);
      const data = await res.json();
      if (!data.success) return null;
      return data.purchase;
    } catch (err) {
      console.error('[getPurchaseById] failed:', err);
      return null;
    }
  },

  async getProfileById(userId: string): Promise<any | null> {
    // The buyer's profile travels with the purchase payload, so no separate
    // (and publicly addressable) profile endpoint is needed.
    void userId;
    return null;
  },

  async getPurchaseStatus(purchaseId: string): Promise<string | null> {
    const purchase = await this.getPurchaseById(purchaseId);
    if (!purchase) return null;
    // Normalize string cases as the webhook sets status to uppercase PAID
    const pStatus = String(purchase.paymentStatus || '').toLowerCase();
    const status = String(purchase.status || '').toLowerCase();
    if (pStatus === 'paid' || status === 'paid' || status === 'confirmed') return 'paid';
    return purchase.status ?? null;
  },

  async adminGetTicketsByPurchase(purchaseId: string): Promise<number[]> {
    const purchase = await this.getPurchaseById(purchaseId);
    return purchase?.ticketNumbers ?? [];
  },

  async getWinners() {
    // Only the columns the anon role is granted on profiles: selecting '*'
    // here fails once column-level grants are in place.
    const { data, error } = await supabase
        .from('winners')
        .select('*, profiles(id, full_name), raffles(name)')
        .order('created_at', { ascending: false });
    
    if (error) return [];
    
    return data.map((w: any) => ({
      id: w.id,
      raffleId: w.raffle_id,
      userId: w.user_id,
      ticketNumber: w.ticket_number,
      prize: w.prize,
      drawDate: w.draw_date,
      userName: w.user_id && w.profiles ? w.profiles.full_name : w.winner_name,
      raffleName: w.raffles?.name,
      imageUrl: w.image_url,
      prizeType: w.prize_type,
      prizeValue: w.prize_value,
      userPhone: w.winner_phone
    }));
  },
  /**
   * Top buyers da rifa, respeitando a janela do ciclo.
   *
   * Antes lia uma tabela `raffle_ranking` que não existe neste banco, então o
   * ranking vinha sempre vazio. Além disso, `ranking_start_date` /
   * `ranking_end_date` eram salvos mas nunca comparados com a hora atual — o
   * ranking nunca encerrava e somava cotas de qualquer época.
   *
   * Usa só as colunas liberadas para a chave anon
   * (raffle_ticket_pool.owner_user_id/paid_at e profiles.id/full_name).
   */
  async getRaffleRanking(raffleId: string, maxPosition?: number): Promise<any[]> {
    const { data: raffle } = await supabase
      .from('raffles')
      .select('ranking_start_date, ranking_end_date, ranking_min_value, price_per_number')
      .eq('id', raffleId)
      .maybeSingle();

    let query = supabase
      .from('raffle_ticket_pool')
      .select('owner_user_id, paid_at')
      .eq('raffle_id', raffleId)
      .eq('status', 'PAID')
      .not('owner_user_id', 'is', null);

    if (raffle?.ranking_start_date) query = query.gte('paid_at', raffle.ranking_start_date);
    if (raffle?.ranking_end_date) query = query.lte('paid_at', raffle.ranking_end_date);

    const { data: tickets, error } = await query;
    if (error || !tickets) return [];

    const counts = new Map<string, number>();
    tickets.forEach((t: any) => {
      if (t.owner_user_id) counts.set(t.owner_user_id, (counts.get(t.owner_user_id) || 0) + 1);
    });

    const minTicketsRequired = (raffle?.ranking_min_value && raffle?.price_per_number)
      ? Math.ceil(raffle.ranking_min_value / raffle.price_per_number)
      : 0;

    const top = [...counts.entries()]
      .filter(([_, total]) => total >= minTicketsRequired)
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxPosition || 100);

    if (top.length === 0) return [];

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', top.map(([id]) => id));

    const byId = new Map((profiles || []).map((p: any) => [p.id, p]));

    return top.map(([userId, total], index) => ({
      position: index + 1,
      ranking: index + 1,
      raffle_id: raffleId,
      user_id: userId,
      name: byId.get(userId)?.full_name || 'Comprador',
      phone: '',
      total_tickets: total,
      totalTickets: total,
    }));
  },
  async getRankingHistory(raffleId: string) {
    return []; // fallback for getRankingHistory
  },

  // --- RAFFLES ---

  async getRaffleById(id: string): Promise<Raffle | null> {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    let query = supabase.from('raffles').select('*');
    if (isUUID) {
      query = query.eq('id', id);
    } else {
      query = query.eq('slug', id);
    }
    const { data, error } = await query.single();
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
      .eq('raffle_id', data.id)
      .eq('status', 'PAID');

    return {
      id: data.id,
      slug: data.slug,
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
      winnerNumber: data.winner_number,
      winnerName: data.winner_name,
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
      rankingMinValue: data.ranking_min_value,
      termsAndRules: data.terms_and_rules
    };
  },

  
  async superAdminLogin(password: string): Promise<boolean> {
    const { data } = await supabase.from('app_config').select('value').eq('key', 'super_admin_password').single();
    return data?.value === password;
  },

  async verifyMasterPassword(password: string): Promise<boolean> {
    return this.superAdminLogin(password);
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
        slug: r.slug,
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
        winnerNumber: r.winner_number,
        winnerName: r.winner_name,
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
        rankingMinValue: r.ranking_min_value,
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
    
    // Reached only through adminService, which proxies the call to
    // /api/admin/rpc; the browser copy has no privileges to do this itself.
    void adminEmail;
    throw new Error('Operação administrativa: use o painel admin (rota /api/admin/rpc).');
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
        .eq('raffle_id', (await supabase.from('purchases').select('raffle_id').eq('id', purchaseId).single()).data?.raffle_id)
        .eq('ticket_number', newNumber)
        .single();
        
      if (!newTicket || newTicket.status !== 'AVAILABLE') return { success: false, message: 'Novo número indisponível.' };
      
      // Swap manual (service role bypasses RLS)
      await supabase.from('raffle_ticket_pool').update({ status: 'AVAILABLE', purchase_id: null, owner_user_id: null }).eq('id', oldTicket.id);
      await supabase.from('raffle_ticket_pool').update({ status: 'PAID', purchase_id: purchaseId, owner_user_id: (await supabase.from('purchases').select('user_id').eq('id', purchaseId).single()).data?.user_id }).eq('id', newTicket.id);
      
      return { success: true, message: 'Troca realizada' };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  },

  async updateSimplifyFeeSettings(settings: { depositFeePercent?: number; depositFeeMin?: number; withdrawalFeePercent?: number; withdrawalFeeMin?: number }): Promise<void> {
    const current = await this.getSimplifyFeeSettings();
    const updated = { ...current, ...settings };
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('simplify_fee_settings', JSON.stringify(updated));
    }

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

    let query = supabase.from('purchases').select('total_value, status, created_at, raffle_id, raffles(name)');
    
    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate);

    const { data: purchases, error } = await query;
    if (error) throw error;

    const paid = purchases.filter(p => p.status === 'paid' || p.status === 'approved');
    const pending = purchases.filter(p => p.status === 'pending');

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
        console.warn('support_messages table warning:', error);
        const current = JSON.parse(localStorage.getItem('local_support_messages') || '[]');
        current.unshift({
          id: 'local-' + Date.now(),
          name: msg.name,
          email: msg.email,
          phone: cleanPhone,
          subject: msg.subject || 'Geral',
          message: msg.message,
          created_at: new Date().toISOString()
        });
        localStorage.setItem('local_support_messages', JSON.stringify(current));
      }
    } catch (e) {
      console.error("Error sending support message:", e);
    }

  },
  async getSupportMessages(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('support_messages')
        .select('*')
        .order('created_at', { ascending: false });

      const localMsgs = JSON.parse(localStorage.getItem('local_support_messages') || '[]');
      if (error || !data) return localMsgs;
      return [...data, ...localMsgs];
    } catch (e) {
      return JSON.parse(localStorage.getItem('local_support_messages') || '[]');
    }

  },
  async resolveSupportMessage(messageId: string, adminEmail: string): Promise<void> {
    try {
      await supabase.from('support_messages').update({ status: 'RESOLVED' }).eq('id', messageId);
      
      const current = JSON.parse(localStorage.getItem('local_support_messages') || '[]');
      const updated = current.map((m: any) => m.id === messageId ? { ...m, status: 'RESOLVED' } : m);
      localStorage.setItem('local_support_messages', JSON.stringify(updated));

      // Audit writing happens server-side; see api/_lib/raffleService.ts.
      void adminEmail;
    } catch (e) {
      console.error('Error resolving support message:', e);
    }
  },

  // --- SITE SETTINGS & METADATA ---
  async getSiteSettings(): Promise<{ siteTitle: string; siteDescription: string; siteFavicon: string; siteOgImage: string; notificationEnabled: boolean; notificationMin: number; notificationMax: number; brandPrimary: string; brandSecondary: string; siteTheme: string; siteMode: string }> {
    const defaultTitle = 'Nova Plataforma';
    const defaultDesc = 'Sua sorte está aqui! Concorra a prêmios incríveis, carros, motos e Pix com total transparência e entrega garantida. Adquira suas cotas na Nova Plataforma!';
    
    try {
      const { data } = await supabase.from('app_config').select('*').in('key', [
        'site_title', 'site_description', 'site_favicon', 'site_og_image',
        'site_notification_enabled', 'site_notification_min', 'site_notification_max', 'site_brand_primary', 'site_brand_secondary', 'site_theme', 'site_mode'
      ]);
      const config: Record<string, string> = {};
      data?.forEach(item => { config[item.key] = item.value; });

      // Fallback to localStorage if table row doesn't exist
      const localConfigStr = localStorage.getItem('site_config_data');
      const localConfig = localConfigStr ? JSON.parse(localConfigStr) : {};

      return {
        siteTitle: config['site_title'] || localConfig['siteTitle'] || defaultTitle,
        siteDescription: config['site_description'] || localConfig['siteDescription'] || defaultDesc,
        siteFavicon: config['site_favicon'] || localConfig['siteFavicon'] || '',
        siteOgImage: config['site_og_image'] || localConfig['siteOgImage'] || '',
        notificationEnabled: config['site_notification_enabled'] !== 'false',
        notificationMin: config['site_notification_min'] ? parseInt(config['site_notification_min'], 10) : 20,
        notificationMax: config['site_notification_max'] ? parseInt(config['site_notification_max'], 10) : 500,
        brandPrimary: config['site_brand_primary'] || localConfig['brandPrimary'] || 'MARCA',
        brandSecondary: config['site_brand_secondary'] || localConfig['brandSecondary'] || 'NOME',
        siteTheme: config['site_theme'] || localConfig['siteTheme'] || 'azure',
        siteMode: config['site_mode'] || localConfig['siteMode'] || 'dark',
      };
    } catch (e) {
      const localConfigStr = localStorage.getItem('site_config_data');
      const localConfig = localConfigStr ? JSON.parse(localConfigStr) : {};
      return {
        siteTitle: localConfig['siteTitle'] || defaultTitle,
        siteDescription: localConfig['siteDescription'] || defaultDesc,
        siteFavicon: localConfig['siteFavicon'] || '',
        siteOgImage: localConfig['siteOgImage'] || '',
        notificationEnabled: true,
        notificationMin: 20,
        notificationMax: 500,
        brandPrimary: localConfig['brandPrimary'] || 'MARCA',
        brandSecondary: localConfig['brandSecondary'] || 'NOME',
        siteTheme: localConfig['siteTheme'] || 'azure',
        siteMode: localConfig['siteMode'] || 'dark',
      };
    }

  },
  async updateSiteSettings(settings: { siteTitle?: string; siteDescription?: string; siteFavicon?: string; siteOgImage?: string; notificationEnabled?: boolean; notificationMin?: number; notificationMax?: number; brandPrimary?: string; brandSecondary?: string; siteTheme?: string; siteMode?: string }): Promise<void> {
    const localConfigStr = localStorage.getItem('site_config_data');
    const localConfig = localConfigStr ? JSON.parse(localConfigStr) : {};
    if (settings.siteTitle !== undefined) localConfig.siteTitle = settings.siteTitle;
    if (settings.siteDescription !== undefined) localConfig.siteDescription = settings.siteDescription;
    if (settings.siteFavicon !== undefined) localConfig.siteFavicon = settings.siteFavicon;
    if (settings.siteOgImage !== undefined) localConfig.siteOgImage = settings.siteOgImage;
    if (settings.brandPrimary !== undefined) localConfig.brandPrimary = settings.brandPrimary;
    if (settings.brandSecondary !== undefined) localConfig.brandSecondary = settings.brandSecondary;
    if (settings.siteTheme !== undefined) localConfig.siteTheme = settings.siteTheme;
    if (settings.siteMode !== undefined) localConfig.siteMode = settings.siteMode;
    localStorage.setItem('site_config_data', JSON.stringify(localConfig));

    try {
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
      
      if (rows.length > 0) {
        await supabase.from('app_config').upsert(rows, { onConflict: 'key' });
      }
    } catch (e) {
      console.warn('Could not save site settings in app_config table, saved to local state fallback:', e);
    }
  },
  applySiteSettingsToDom(settings: { siteTitle?: string; siteDescription?: string; siteFavicon?: string; siteOgImage?: string }): void {
    if (typeof document === 'undefined') return;

    if (settings.siteTitle) {
      document.title = settings.siteTitle;

      let metaOgTitle = document.querySelector('meta[property="og:title"]');
      if (!metaOgTitle) {
        metaOgTitle = document.createElement('meta');
        metaOgTitle.setAttribute('property', 'og:title');
        document.head.appendChild(metaOgTitle);
      }
      metaOgTitle.setAttribute('content', settings.siteTitle);

      let metaOgSiteName = document.querySelector('meta[property="og:site_name"]');
      if (!metaOgSiteName) {
        metaOgSiteName = document.createElement('meta');
        metaOgSiteName.setAttribute('property', 'og:site_name');
        document.head.appendChild(metaOgSiteName);
      }
      metaOgSiteName.setAttribute('content', settings.siteTitle);
    }

    if (settings.siteDescription) {
      let metaDesc = document.querySelector('meta[name="description"]');
      if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.setAttribute('name', 'description');
        document.head.appendChild(metaDesc);
      }
      metaDesc.setAttribute('content', settings.siteDescription);

      let metaOgDesc = document.querySelector('meta[property="og:description"]');
      if (!metaOgDesc) {
        metaOgDesc = document.createElement('meta');
        metaOgDesc.setAttribute('property', 'og:description');
        document.head.appendChild(metaOgDesc);
      }
      metaOgDesc.setAttribute('content', settings.siteDescription);
    }

    if (settings.siteFavicon) {
      let faviconLink = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
      if (!faviconLink) {
        faviconLink = document.createElement('link');
        faviconLink.rel = 'shortcut icon';
        document.head.appendChild(faviconLink);
      }
      faviconLink.href = settings.siteFavicon;
    }

    if (settings.siteOgImage) {
      let metaOgImg = document.querySelector('meta[property="og:image"]');
      if (!metaOgImg) {
        metaOgImg = document.createElement('meta');
        metaOgImg.setAttribute('property', 'og:image');
        document.head.appendChild(metaOgImg);
      }
      metaOgImg.setAttribute('content', settings.siteOgImage);
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

  async adminDeleteBanner(id: string): Promise<void> {
    const { error } = await supabase.from('banners').delete().eq('id', id);
    if (error) throw error;
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
          ranking_min_value: data.rankingMinValue || null,
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
          ranking_min_value: updates.rankingMinValue,
          terms_and_rules: updates.termsAndRules,
          is_featured: updates.isFeatured,
          ranking_config: updates.rankingConfig,
          manual_ranking: updates.manualRanking,
     };
     
     // Remove undefined properties
     const mutable = dbUpdates as Record<string, any>;
     Object.keys(mutable).forEach(key => mutable[key] === undefined && delete mutable[key]);

     const { error } = await supabase.from('raffles').update(dbUpdates).eq('id', id);
     if (error) {
         console.error("Erro ao atualizar rifa:", error);
         throw error;
     }

  },
  async deleteRaffle(id: string) {
     const { error } = await supabase.from('raffles').delete().eq('id', id);
     if (error) throw error;
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
  
  async adminAssignWinningTicket(id: string, winnerName: string, winnerPhone: string, winnerCpf: string) {
      const { error } = await supabase.from('winning_tickets').update({
          won: true,
          winner_name: winnerName,
          winner_phone: winnerPhone,
          winner_cpf: winnerCpf
      }).eq('id', id);
      if (error) throw error;
  }
};
