const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if (key && val.length) acc[key.trim()] = val.join('=').trim().replace(/"/g, '');
  return acc;
}, {});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY);
// We might need service role key to update if RLS blocks update on lojas for anon
supabase.from('lojas').update({ chat_ia_ativo: true }).neq('id', '00000000-0000-0000-0000-000000000000').then(res => console.log('Updated:', res));
