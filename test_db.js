const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://fanffwnhkxpfhttylntw.supabase.co';
const supabaseAnonKey = 'sb_publishable_fsrieSLUXlq-_WDpPY9K_w_eO-dN_jT';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  const { data: users, error } = await supabase.from('users').select('*').limit(5);
  console.log("Users:", users);
  
  if (error) console.error("Error:", error);
}

test();
