const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase.from('purchases').select('id, user_id, status').order('created_at', { ascending: false }).limit(5);
  console.log("Latest Purchases:", data);
}
run();
