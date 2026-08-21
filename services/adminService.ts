import { supabase } from './supabaseClient';
import { raffleService as realRaffleService } from './raffleService';

/**
 * Admin operations that exist only on the server service
 * (api/_lib/raffleService.ts) and are reached through /api/admin/rpc.
 *
 * They are declared here because `adminService` is a Proxy: without an explicit
 * type the compiler cannot know these calls are valid, and the admin panel used
 * to reference a dozen methods that existed nowhere at all — those calls
 * type-checked as `any` and failed at runtime with "Invalid action".
 *
 * Every name below must also appear in the allow-list in
 * api/_handlers/admin/rpc.ts, otherwise the request is rejected.
 */
export interface AdminOnlyOperations {
  // Audit trail
  // Meta Pixels
  adminGetMetaPixels(): Promise<any[]>;
  adminCreateMetaPixel(pixel_id: string): Promise<any>;
  adminToggleMetaPixel(id: string, is_active: boolean): Promise<{ success: boolean }>;
  adminDeleteMetaPixel(id: string): Promise<{ success: boolean }>;

  getAuditLogs(includeHidden?: boolean): Promise<any[]>;
  logAuditAction(adminEmail: string, actionType: string, details: string): Promise<void>;

  // CRM & sales
  getUsersCRM(): Promise<any[]>;
  adminGetAllPurchases(limit?: number): Promise<any[]>;
  adminUpdatePurchase(
    purchaseId: string,
    updates: { purchase_date?: string; name?: string; phone?: string; cpf?: string; status?: string }
  ): Promise<void>;
  approvePurchase(purchaseId: string): Promise<{ success: boolean; error?: string }>;
  cancelExpiredPurchases(): Promise<void>;
  adminGetTicketsByPurchase(purchaseId: string): Promise<number[]>;

  // Ticket administration
  adminClearRaffleTickets(raffleId: string): Promise<{ success: boolean; released: number }>;
  getTicketOwner(raffleId: string, ticketNumber: number): Promise<{ data: any | null; error: string | null }>;
  checkCpfInfo(
    cpf: string,
    raffleId?: string
  ): Promise<{ exists: boolean; name?: string; phone?: string; userId?: string; hasPurchaseInRaffle: boolean }>;
  adminProcessTicketAssignment(
    raffleId: string,
    ticketNumber: number,
    cpf: string,
    name: string,
    phone: string,
    purchaseDate?: string
  ): Promise<{ success: boolean; purchaseId: string }>;
  adminManualAssignWinner(
    winningTicketId: string,
    raffleId: string,
    ticketNumber: number,
    name: string,
    cpf: string,
    phone: string,
    imageUrl?: string
  ): Promise<{ success: boolean }>;
  adminRegisterWinner(payload: {
    raffleId: string;
    userId?: string | null;
    ticketNumber: number;
    prizeDescription: string;
    prizeType?: string;
    prizeValue?: number | null;
    imageUrl?: string | null;
    isManual?: boolean;
    winnerName?: string;
    winnerPhone?: string;
    drawDate?: string;
  }): Promise<{ success: boolean; id: string }>;

  adminGetWinners(): Promise<any[]>;
  adminUpdateWinnerDeliveryStatus(winnerId: string, status: string): Promise<{ success: boolean }>;
  adminGetPurchaseByTicket(raffleId: string, ticketNumber: number): Promise<any>;

  // Ranking & simulation
  getRaffleRanking(raffleId: string, maxPosition?: number): Promise<any[]>;
  finalizeRankingCycle(raffleId: string, topBuyer?: any): Promise<{ success: boolean }>;
  getSimulationNumbers(raffleId: string): Promise<number[]>;

  // Super admin
  superAdminToggleShadowMode(raffleId: string, enabled: boolean): Promise<{ success: boolean }>;
}

export type AdminService = typeof realRaffleService & AdminOnlyOperations;

/**
 * Proxies every method call to POST /api/admin/rpc, where the action name is
 * checked against an allow-list and the caller's role before anything runs.
 */
export const adminService = new Proxy({}, {
  get(_target, prop) {
    if (typeof prop !== 'string') return undefined;

    // A Proxy intercepts internal lookups too (`then` during an await,
    // `toJSON` when serialising). Returning a function for those makes the
    // object look thenable and breaks awaits, so they are passed through.
    if (prop === 'then' || prop === 'toJSON' || prop === 'constructor') return undefined;

    return async (...args: any[]) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Admin panel: authenticate with the Supabase session token.
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      // Super admin panel: the master password is held in sessionStorage for
      // the duration of the tab and sent per request.
      const masterPassword =
        typeof window !== 'undefined' ? sessionStorage.getItem('master_password') : null;
      if (masterPassword) {
        headers['x-master-password'] = masterPassword;
      }

      const res = await fetch('/api/admin/rpc', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: prop, args }),
      });

      // The API always answers with JSON, but a proxy or platform error page
      // could still arrive as HTML — reading it as text first turns that into a
      // clear message instead of "Unexpected token '<' is not valid JSON".
      const raw = await res.text();
      let data: any;
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(
          `Resposta inválida do servidor (HTTP ${res.status}) ao executar "${prop}".`
        );
      }

      if (!data.success) {
        throw new Error(data.error || `Erro na chamada de ${prop}`);
      }

      return data.result;
    };
  },
}) as AdminService;
