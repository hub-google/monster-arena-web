import { createClient } from '@supabase/supabase-js';

// Original game backend. Keep this project reference to preserve all existing accounts.
export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://fanffwnhkxpfhttylntw.supabase.co';
const publishableKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_fsrieSLUXlq-_WDpPY9K_w_eO-dN_jT';

// Publishable API keys are designed for browsers. NEVER expose service_role.
export const supabase = createClient(supabaseUrl, publishableKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});
