import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(url, key);

async function test() {
  const { data, error } = await supabase.from('raffles').select('id, ranking_min_value').limit(1);
  console.log("Error:", error);
  console.log("Data:", data);
  
  // also check with just select *
  const { data: d2 } = await supabase.from('raffles').select('*').limit(1);
  console.log("Keys in select * :", Object.keys(d2[0] || {}));
}
test();
