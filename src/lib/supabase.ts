import { createClient } from '@supabase/supabase-js';

// Fallback to window.__ENV__ for runtime injection in production (Hugging Face)
const PUBLIC_URL = 'https://vjmwknqdeilrvocimwsw.supabase.co';
const PUBLIC_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqbXdrbnFkZWlscnZvY2ltd3N3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NDcwNzYsImV4cCI6MjA5NjUyMzA3Nn0.QyWatsxgLI6bT-oNqq0SShWQvZSkRlP1EgzvHeJg4Ec';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || (window as any).__ENV__?.VITE_SUPABASE_URL || PUBLIC_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || (window as any).__ENV__?.VITE_SUPABASE_ANON_KEY || PUBLIC_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
