import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://unapiwajmgqqtdkixaab.supabase.co';
const supabaseAnonKey = 'sb_publishable_L09XC4Tekm6cZaPTTczm3g_Aap-SOSy';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
