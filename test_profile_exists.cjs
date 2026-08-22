const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

async function run() {
  const { data } = await supabase.from('profiles').select('*').eq('cpf', '10000000000').single();
  console.log(data);
}
run();
