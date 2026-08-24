require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
  const { data, error } = await supabase.from('raffles').select('id, ranking_min_value').limit(1);
  console.log("Error:", error);
  console.log("Data:", data);
}
test();
