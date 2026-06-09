import { createClient } from '@supabase/supabase-js';

// Fallback to window.__ENV__ for runtime injection in production (Hugging Face)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || (window as any).__ENV__?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || (window as any).__ENV__?.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials missing in frontend. Persistence may fail.');
}

export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder');
