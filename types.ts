export enum RaffleStatus {
  ACTIVE = 'ACTIVE',
  FINISHED = 'FINISHED'
}

export interface Raffle {
  id: string;
  slug?: string;
  name: string;
  description: string;
  fullDescription: string;
  imageUrl: string;
  totalNumbers: number;
  soldNumbers: number;
  fakeSoldNumbers?: number;
  pricePerNumber: number;
  minPurchase: number;
  status: RaffleStatus;
  winnerNumber?: number | null;
  winnerName?: string | null;
  drawDate?: string;
  isFeatured?: boolean;
  hasScratchCards?: boolean;
  ticketsPerScratchCard?: number;
  scratchCardCombos?: { quantity: number; price: number }[];
  useSecondaryGateway?: boolean;
  rankingConfig?: { position: number; prize: string }[];
  rankingStartDate?: string;
  rankingEndDate?: string;
  securityMarginPercent?: number;
  manualRanking?: { name: string; phone: string; totalTickets: number }[];
  showPromoBanner?: boolean;
  promoBannerTitle?: string;
  promoBannerSubtitle?: string;
  showRanking?: boolean;
  termsAndRules?: string;
}

export interface Profile {
  id: string;
  fullName: string;
  cpf: string;
  phone: string;
  email?: string;
  password?: string;
  birthDate?: string;
  cep?: string;
  address?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  complement?: string;
  role: 'admin' | 'superadmin' | 'user';
  createdAt: string;
}

export interface Purchase {
  id: string;
  userId: string;
  raffleId: string;
  quantity: number;
  totalValue: number;
  status: 'pending' | 'paid' | 'cancelled';
  pixCode?: string;
  pixQrCode?: string;
  createdAt: string;
  raffleName?: string;
  raffleImageUrl?: string;
  raffleStatus?: RaffleStatus;
  ticketNumbers?: number[];
  scratchCards?: ScratchCard[];
}

export interface ScratchCard {
  id: string;
  purchaseId: string;
  userId: string;
  raffleId: string;
  number: string;
  isRevealed: boolean;
  isWinner: boolean;
  prizeName?: string;
  revealedAt?: string;
  createdAt: string;
}

export interface Winner {
  id: string;
  raffleId: string;
  userId: string;
  ticketNumber: number;
  prize: string;
  drawDate: string;
  userName?: string;
  raffleName?: string;
  imageUrl?: string;
  prizeType?: string; // 'rifa' | 'bilhete'
  prizeValue?: number;
  userPhone?: string;
  notified_at?: string | null;
  delivery_status?: 'PENDING' | 'IN_CONTACT' | 'DELIVERED';
}

export interface WinningTicket {
  id: string;
  raffleId: string;
  ticketNumber: number;
  prizeDescription: string;
  userId?: string;
  winnerName?: string;
  isActive: boolean;
  won: boolean;
}

export interface RecentWinner {
  id: string;
  userName: string;
  prize: string;
  raffleName: string;
  drawDate: string;
}

export interface Banner {
  id: string;
  image_url: string;
  is_active?: boolean;
  active?: boolean;
  created_at?: string;
}

// Helper type for Supabase raw response if needed
export interface DB_Purchase {
  id: string;
  raffle_id: string;
  name: string;
  cpf: string;
  phone: string;
  quantity: number;
  total_value: number;
  purchase_date: string;
}

export interface PurchaseResult {
  success: boolean; 
  numbers: number[]; 
  message?: string;
  wonPrizes?: { number: number; prize: string }[]; // New field for instant wins
}

export interface RaffleTicketPool {
  id: string;
  raffle_id: string;
  ticket_number: number;
  random_order: number;
  purchase_id?: string;
  owner_user_id?: string;
  status: 'AVAILABLE' | 'RESERVED' | 'PAID' | 'BLOCKED';
  is_winner: boolean;
  is_instant_winner: boolean;
  reserved_at?: string;
  paid_at?: string;
  drawn_at?: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface TicketAuditLog {
  id: string;
  ticket_pool_id: string;
  raffle_id: string;
  action: string;
  old_status?: string;
  new_status?: string;
  old_owner_id?: string;
  new_owner_id?: string;
  changed_by_admin_id?: string;
  created_at: string;
}
