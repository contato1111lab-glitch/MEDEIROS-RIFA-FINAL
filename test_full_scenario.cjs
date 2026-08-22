const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

async function run() {
  const cleanCpf = '12345678912'; // a new cpf
  
  // 1. Simulate what /payments/create does
  const { data: newUser, error: uErr } = await supabase.from('profiles').insert({
    full_name: 'Test Buyer 2',
    cpf: cleanCpf,
    phone: '11999999999',
    role: 'user'
  }).select('id').single();
  console.log("Created Profile:", newUser?.id, "Err:", uErr);
  
  // 2. Simulate what /api/auth does
  const { data: user, error: loginErr } = await supabase
    .from("profiles")
    .select("*")
    .eq("cpf", cleanCpf)
    .single();
    
  console.log("Login user found:", user?.id, "Err:", loginErr);
  
  if (newUser) {
    await supabase.from('profiles').delete().eq('id', newUser.id);
  }
}
run();
