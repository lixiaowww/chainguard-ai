import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || (window as any).__ENV__?.VITE_SUPABASE_URL || 'https://vjmwknqdeilrvocimwsw.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || (window as any).__ENV__?.VITE_SUPABASE_ANON_KEY || 'sb_publishable_aJVVMTk3qgNBSlcDGpfH1w_uHyxIAX_';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase credentials missing!');
}

console.log('Using Supabase mode: Publishable Key Detected');

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
