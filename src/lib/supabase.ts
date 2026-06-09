import { createClient } from '@supabase/supabase-js';

// Fallback to window.__ENV__ for runtime injection in production (Hugging Face)
const PUBLIC_URL = 'https://vjmwknqdeilrvocimwsw.supabase.co';
const PUBLIC_ANON_KEY = 'sb_publishable_aJVVMTk3qgNBSlcDGpfH1w_uHyxIAX_';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || (window as any).__ENV__?.VITE_SUPABASE_URL || PUBLIC_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || (window as any).__ENV__?.VITE_SUPABASE_ANON_KEY || PUBLIC_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials missing in frontend. Persistence may fail.');
}

console.log('Supabase initialized with URL:', supabaseUrl);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
