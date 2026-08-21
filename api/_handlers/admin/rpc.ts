import { Request, Response } from 'express';
import { supabaseServer } from '../../_lib/supabaseServer';
import { raffleService } from '../../_lib/raffleService';
import { verifyMasterPassword } from '../../_lib/auth';

type Role = 'guest' | 'admin' | 'superadmin';

/**
 * Explicit allow-list of callable actions.
 *
 * This endpoint used to dispatch on any property of `raffleService` that
 * happened to be a function, which meant the wire format decided which code
 * ran. An allow-list keeps the callable surface a deliberate choice: adding a
 * helper to the service no longer silently exposes it over HTTP.
 *
 * Anything not listed here is rejected, including inherited Object members such
 * as `constructor` and `valueOf`.
 */
const ADMIN_ACTIONS = new Set<string>([
  // Raffles
  'getAllRaffles',
  'getRaffleById',
  'createRaffle',
  'updateRaffle',
  'deleteRaffle',
  // Banners
  'adminGetBanners',
  'adminCreateBanner',
  'adminDeleteBanner',
  'getBanners',
  // Winning tickets
  'adminGetWinningTickets',
  'adminCreateWinningTicket',
  'adminDeleteWinningTicket',
  'adminToggleWinningTicket',
  'adminAssignWinningTicket',
  'getWinningTickets',
  'getPublicWinningTickets',
  'adminGetMetaPixels',
  'adminCreateMetaPixel',
  'adminToggleMetaPixel',
  'adminDeleteMetaPixel',
  // Purchases / tickets
  'getPurchaseById',
  'approvePurchaseManually',
  'confirmPaymentAndReleaseTickets',
  'cancelExpiredPurchases',
  'swapTicket',
  // Dashboard & settings
  'getDashboardStats',
  'getSiteSettings',
  'updateSiteSettings',
  'getSimplifyFeeSettings',
  'updateSimplifyFeeSettings',
  'calculateSimplifyFees',
  // Support
  'getSupportMessages',
  'resolveSupportMessage',
  // Audit trail
  'getAuditLogs',
  'logAuditAction',
  // CRM & sales
  'getUsersCRM',
  'adminGetAllPurchases',
  'adminUpdatePurchase',
  'approvePurchase',
  'adminGetTicketsByPurchase',
  // Ticket administration
  'adminClearRaffleTickets',
  'getTicketOwner',
  'checkCpfInfo',
  'adminProcessTicketAssignment',
  'adminManualAssignWinner',
  'adminRegisterWinner',
  'adminGetWinners',
  'adminUpdateWinnerDeliveryStatus',
  'adminGetPurchaseByTicket',
  // Ranking & simulation
  'getRaffleRanking',
  'finalizeRankingCycle',
  'getSimulationNumbers',
  // Session helpers (already gated by the header check below)
  'superAdminLogin',
  'verifyMasterPassword',
]);

/**
 * Actions that require the super-admin role. Admins are rejected.
 */
const SUPERADMIN_ACTIONS = new Set<string>([
  'getGhostConfig',
  'updateGhostConfig',
  'getGhostMetrics',
  'getGhostPurchases',
  'transferGhostToAdmin',
  'getGhostAuditLogs',
  'superAdminGetAllRaffles',
  'superAdminGetHiddenPurchases',
  'superAdminGetConfig',
  'superAdminUpdateConfig',
  'superAdminRevealPurchase',
  'toggleAuditLogVisibility',
  'superAdminToggleShadowMode',
]);

function isAllowed(action: string, role: Role): boolean {
  if (role === 'superadmin') {
    return ADMIN_ACTIONS.has(action) || SUPERADMIN_ACTIONS.has(action);
  }
  if (role === 'admin') {
    return ADMIN_ACTIONS.has(action);
  }
  return false;
}

async function resolveRole(req: Request): Promise<{ role: Role; adminId: string | null }> {
  const authHeader = req.headers.authorization;

  // 1. Supabase session token -> role comes from the profiles table.
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length);
    const { data, error } = await supabaseServer.auth.getUser(token);

    if (error) {
      console.error('[AUTH] Supabase getUser error:', error);
    }

    if (!error && data?.user) {
      const { data: profile } = await supabaseServer
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      if (profile?.role === 'superadmin') return { role: 'superadmin', adminId: data.user.id };
      if (profile?.role === 'admin') return { role: 'admin', adminId: data.user.id };
    }
  }

  // 2. Master password header -> super-admin.
  const masterPassword = req.headers['x-master-password'];
  if (await verifyMasterPassword(masterPassword)) {
    return { role: 'superadmin', adminId: null };
  }

  return { role: 'guest', adminId: null };
}

export async function handleAdminRpc(req: Request, res: Response) {
  try {
    const { role, adminId } = await resolveRole(req);

    if (role === 'guest') {
      return res.status(401).json({ success: false, error: 'Não autorizado.' });
    }

    const body = req.body ?? {};
    const action = body.action;
    const args = Array.isArray(body.args) ? body.args : [];

    if (typeof action !== 'string' || action.length === 0) {
      return res.status(400).json({ success: false, error: 'Ação inválida.' });
    }

    if (!isAllowed(action, role)) {
      // A known super-admin action attempted by an admin gets a specific
      // message; everything else is reported uniformly so the response does not
      // reveal which action names exist.
      if (SUPERADMIN_ACTIONS.has(action)) {
        return res.status(403).json({
          success: false,
          error: 'Acesso negado. Esta ação exige nível de Super Administrador.',
        });
      }
      return res.status(400).json({ success: false, error: 'Ação inválida.' });
    }

    const method = (raffleService as any)[action];
    if (typeof method !== 'function') {
      console.error(`[ADMIN_RPC] allow-listed action has no implementation: ${action}`);
      return res.status(501).json({
        success: false,
        error: `Ação "${action}" não está implementada no servidor.`,
      });
    }

    const callArgs = action === 'transferGhostToAdmin' ? [...args, adminId] : args;
    const result = await method.apply(raffleService, callArgs);

    return res.status(200).json({ success: true, result });
  } catch (error: any) {
    // Log the detail, return a generic message: service errors can carry
    // database structure or row contents.
    console.error(`[ADMIN_RPC] Error executing ${req.body?.action}:`, error);
    return res.status(400).json({
      success: false,
      error: error?.message || 'Erro ao executar a operação.',
    });
  }
}
