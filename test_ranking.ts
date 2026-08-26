import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(url, key);

async function run() {
  // Find Danillo and Rafaela
  const { data: profiles } = await supabase.from('profiles').select('id, full_name').or('full_name.ilike.%Danillo%,full_name.ilike.%Rafaela%');
  console.log('Profiles:', profiles);

  // Get active raffle
  const { data: raffles } = await supabase.from('raffles').select('id, name').limit(5);
  console.log('Raffles:', raffles);

  const raffleId = raffles?.[0]?.id;
  if (!raffleId) return;

  // Check how many PAID tickets total for this raffle
  const { count: totalPaid } = await supabase.from('raffle_ticket_pool')
    .select('*', { count: 'exact', head: true })
    .eq('raffle_id', raffleId)
    .eq('status', 'PAID');
    
  console.log(`Total PAID tickets in raffle ${raffleId}:`, totalPaid);

  if (profiles) {
    for (const p of profiles) {
      const { count } = await supabase.from('raffle_ticket_pool')
        .select('*', { count: 'exact', head: true })
        .eq('raffle_id', raffleId)
        .eq('owner_user_id', p.id)
        .eq('status', 'PAID');
      console.log(`Actual DB count for ${p.full_name}:`, count);
    }
  }
}
run();
