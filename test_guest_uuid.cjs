const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase.from('purchases').insert({
    raffle_id: '22c431db-af47-4858-b2e4-63cbf0b9c2d4',
    user_id: 'guest',
    quantity: 1,
    total_value: 10
  });
  console.log("Guest Insert Error:", error);
}
run();
