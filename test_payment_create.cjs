const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

async function run() {
  const cleanCpf = '12345678901';
  const name = 'Test Buyer';
  const phone = '11999999999';

  const { data: existingUser } = await supabase.from('profiles').select('id').eq('cpf', cleanCpf).maybeSingle();
  let userId = 'guest';
  if (existingUser) {
    userId = existingUser.id;
    console.log("Found existing:", userId);
  } else {
    const { data: newUser, error: uErr } = await supabase.from('profiles').insert({
      full_name: name,
      cpf: cleanCpf,
      phone: phone,
      role: 'user'
    }).select('id').single();
    if (newUser) {
      userId = newUser.id;
      console.log("Created new:", userId);
    } else {
      console.log("Error creating:", uErr);
    }
  }
  
  // Verify if it exists
  const { data: checkUser } = await supabase.from('profiles').select('*').eq('cpf', cleanCpf).single();
  console.log("CheckUser exists?", !!checkUser);
  
  // Cleanup
  if (userId !== 'guest') {
    await supabase.from('profiles').delete().eq('id', userId);
  }
}
run();
