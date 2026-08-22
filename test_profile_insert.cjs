const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

async function run() {
  const { error: insErr } = await supabase.from('profiles').insert({
    full_name: 'Test Name',
    cpf: '88888888888',
    role: 'user'
  });
  console.log("Insert missing phone:", insErr);
  
  await supabase.from('profiles').delete().eq('cpf', '88888888888');
}
run();
