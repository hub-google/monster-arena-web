import { createClient } from '@supabase/supabase-js';

// Requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://fake.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "fake-anon-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export const auth = supabase.auth;
