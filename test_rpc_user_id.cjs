const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase.rpc('rpc_reserve_tickets', {
    p_raffle_id: '00000000-0000-0000-0000-000000000000',
    p_user_id: '00000000-0000-0000-0000-000000000000',
    p_qty: 1,
    p_total_value: 10,
    p_ticket_price: 10
  });
  console.log("RPC Error:", error);
}
run();
