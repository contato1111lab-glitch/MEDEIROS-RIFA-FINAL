const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

async function run() {
  const { error } = await supabase.from('profiles').insert([
    { full_name: 'A', cpf: '11111111111', phone: '1111' },
    { full_name: 'B', cpf: '11111111111', phone: '2222' }
  ]);
  console.log("Insert 2 same CPF Error:", error);
  await supabase.from('profiles').delete().eq('cpf', '11111111111');
}
run();
