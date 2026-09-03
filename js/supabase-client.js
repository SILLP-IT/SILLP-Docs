const SUPABASE_URL = 'https://orocwliyopfnviusixrc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_fKp777RlpfRlfYw9_bwIaA_aQbMDuTH';

let supabaseClient = null;
try {
  if (SUPABASE_URL !== 'YOUR_SUPABASE_PROJECT_URL' && SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY') {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
} catch (e) {
  console.error('Failed to initialize Supabase client:', e);
}

