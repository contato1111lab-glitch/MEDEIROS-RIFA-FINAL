import { Request, Response } from 'express';
import { supabaseServer as supabase } from '../../_lib/supabaseServer';

export async function handleSearchTickets(req: Request, res: Response) {
  // CORS and preflight are handled centrally in api/index.ts against an
  // allow-list, so the per-handler wildcard headers were removed.

  try {
    const { cpf, phone } = req.body;
    const cleanCpf = (cpf || '').replace(/\D/g, '');
    const cleanPhone = (phone || '').replace(/\D/g, '');

    if (!cleanCpf || !cleanPhone) {
      return res.status(400).json({ success: false, error: 'CPF e Telefone são obrigatórios para a consulta.' });
    }

    // 1. Validate Profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, cpf, phone, role, created_at')
      .eq('cpf', cleanCpf)
      .single();

    if (!profile) {
      return res.status(404).json({ success: false, error: 'Nenhum cadastro encontrado para este CPF.' });
    }

    // Strict Phone match check
    const dbPhone = (profile.phone || '').replace(/\D/g, '');
    if (dbPhone !== cleanPhone) {
      return res.status(401).json({ success: false, error: 'Telefone incorreto para o CPF informado.' });
    }
    
    // Check if registration is complete BEFORE masking
    const hasName = !!(profile.full_name && profile.full_name.trim() && !profile.full_name.startsWith('Cliente '));
    const hasCpf = dbPhone.length >= 10;
    
    const registrationComplete = hasName && hasCpf;

    // 2. Mask Profile PII and format to camelCase for the frontend
    const maskedProfile = {
      id: profile.id,
      fullName: maskName(profile.full_name),
      cpf: maskCpf(profile.cpf),
      phone: maskPhone(profile.phone),
                              role: profile.role,
      createdAt: profile.created_at
    };

    // 3. Fetch Tickets owned by this user (source of truth for ticket ownership)
    const { data: userTickets } = await supabase
      .from('raffle_ticket_pool')
      .select('id, raffle_id, ticket_number, purchase_id, paid_at, status, raffles(id, name, image_url, status)')
      .eq('owner_user_id', profile.id)
      .eq('status', 'PAID')
      .order('ticket_number', { ascending: true });

    // Collect purchase IDs from user's tickets to fetch financial & raffle context
    const ticketPurchaseIds = Array.from(
      new Set((userTickets || []).map((t: any) => t.purchase_id).filter(Boolean))
    );

    let allPurchases: any[] = [];
    if (ticketPurchaseIds.length > 0) {
      const { data: pData } = await supabase
        .from('purchases')
        .select('*, raffles(name, image_url, status)')
        .in('id', ticketPurchaseIds)
        .order('created_at', { ascending: false });
      allPurchases = pData || [];
    }

    // Also fetch user's direct purchases (including pending ones)
    const { data: directPurchases } = await supabase
      .from('purchases')
      .select('*, raffles(name, image_url, status)')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false });

    if (directPurchases) {
      for (const dp of directPurchases) {
        if (!allPurchases.some(p => p.id === dp.id)) {
          allPurchases.push(dp);
        }
      }
    }

    const formattedPurchases = [];

    if (allPurchases.length > 0) {
      for (const p of allPurchases) {
        const paymentStatus = String(p.payment_status || '').toLowerCase();
        const status = String(p.status || '').toLowerCase();
        const isCancelled = paymentStatus === 'cancelled' || status === 'cancelled' || status === 'expired' || paymentStatus === 'expired';
        
        if (isCancelled) continue; // Do not send cancelled purchases

        // Filter tickets strictly owned by this user for this purchase
        const ownedTicketsForPurchase = (userTickets || [])
          .filter((t: any) => t.purchase_id === p.id)
          .map((t: any) => t.ticket_number);

        // If purchase is paid but user owns 0 tickets from it (e.g. all were transferred), omit it
        if ((status === 'paid' || paymentStatus === 'paid') && ownedTicketsForPurchase.length === 0) {
          continue;
        }

        formattedPurchases.push({
          id: p.id,
          userId: p.user_id,
          raffleId: p.raffle_id,
          quantity: ownedTicketsForPurchase.length > 0 ? ownedTicketsForPurchase.length : p.quantity,
          totalValue: p.total_value,
          ticketPrice: p.ticket_price,
          status: p.status,
          paymentStatus: p.payment_status,
          pixCode: p.pix_code,
          pixQrCode: p.pix_qr_code,
          createdAt: p.created_at,
          raffleName: p.raffles?.name,
          raffleImageUrl: p.raffles?.image_url,
          raffleStatus: p.raffles?.status,
          ticketNumbers: ownedTicketsForPurchase
        });
      }
    }

    // Check if there are any owned tickets without matching purchases
    const handledTicketNumbers = new Set(formattedPurchases.flatMap(p => p.ticketNumbers));
    const unhandledTickets = (userTickets || []).filter((t: any) => !handledTicketNumbers.has(t.ticket_number));

    if (unhandledTickets.length > 0) {
      const byRaffle: Record<string, any[]> = {};
      for (const ut of unhandledTickets) {
        if (!byRaffle[ut.raffle_id]) byRaffle[ut.raffle_id] = [];
        byRaffle[ut.raffle_id].push(ut);
      }

      for (const [rId, rTickets] of Object.entries(byRaffle)) {
        const firstTicket = rTickets[0];
        const raffleInfo = firstTicket?.raffles;
        formattedPurchases.push({
          id: `transferred-${rId}-${profile.id}`,
          userId: profile.id,
          raffleId: rId,
          quantity: rTickets.length,
          totalValue: 0,
          ticketPrice: 0,
          status: 'PAID',
          paymentStatus: 'PAID',
          pixCode: null,
          pixQrCode: null,
          createdAt: firstTicket.paid_at || new Date().toISOString(),
          raffleName: raffleInfo?.name || 'Rifa',
          raffleImageUrl: raffleInfo?.image_url || null,
          raffleStatus: raffleInfo?.status || 'active',
          ticketNumbers: rTickets.map((t: any) => t.ticket_number).sort((a: number, b: number) => a - b)
        });
      }
    }

    return res.status(200).json({
      success: true,
      profile: maskedProfile,
      registrationComplete,
      purchases: formattedPurchases
    });
  } catch (error: any) {
    console.error('[SEARCH_TICKETS] Error:', error);
    return res.status(500).json({ success: false, error: 'Erro interno ao buscar bilhetes.' });
  }
}

// Masking helpers
function maskName(name: string) {
  if (!name) return '';
  const parts = name.split(' ');
  if (parts.length === 1) return parts[0].slice(0, 3) + '***';
  return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.***`;
}

function maskCpf(cpf: string) {
  if (!cpf) return '';
  const c = cpf.replace(/\D/g, '');
  if (c.length !== 11) return '***.***.***-**';
  return `${c.slice(0,3)}.***.***-${c.slice(9,11)}`;
}

function maskPhone(phone: string) {
  if (!phone) return '';
  const p = phone.replace(/\D/g, '');
  if (p.length < 10) return '(**) ****-****';
  return `(${p.slice(0,2)}) 9****-${p.slice(-4)}`;
}

function maskEmail(email: string) {
  if (!email) return '';
  const [user, domain] = email.split('@');
  if (!domain) return email;
  return `${user.slice(0, 2)}***@${domain}`;
}
