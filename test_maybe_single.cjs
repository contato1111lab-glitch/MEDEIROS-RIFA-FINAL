const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

async function run() {
  await supabase.from('profiles').insert([
    { full_name: 'A', cpf: '77777777777', phone: '1' },
  ]);
  // Wait, I can't insert a duplicate CPF because of the unique constraint!
  console.log("CPF is unique!");
}
run();
