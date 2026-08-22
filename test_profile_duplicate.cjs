const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

async function run() {
  const { error: insErr } = await supabase.from('profiles').insert([{cpf: '99999999999'}, {cpf: '99999999999'}]);
  console.log("Insert Err:", insErr);
  const { data } = await supabase.from('profiles').select('id, cpf').eq('cpf', '99999999999');
  console.log("Data:", data);
  const { error: singleErr } = await supabase.from('profiles').select('*').eq('cpf', '99999999999').single();
  console.log("Single Err:", singleErr);
  await supabase.from('profiles').delete().eq('cpf', '99999999999');
}
run();
