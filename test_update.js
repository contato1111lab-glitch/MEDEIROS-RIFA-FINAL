import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(url, key);

async function test() {
  const id = '22c431db-af47-4858-b2e4-63cbf0b9c2d4'; // from earlier
  
  const dbUpdates = {
      ranking_min_value: 20
  };
  
  const { error } = await supabase.from('raffles').update(dbUpdates).eq('id', id);
  console.log("Update Error:", error);
  
  const { data } = await supabase.from('raffles').select('id, ranking_min_value').eq('id', id).limit(1);
  console.log("Data after update:", data);
}
test();
