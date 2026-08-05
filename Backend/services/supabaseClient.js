const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env'), override: false, quiet: true });
dotenv.config({ path: path.join(__dirname, '..', '..', 'Frontend', '.env'), override: false, quiet: true });
dotenv.config({ path: path.join(__dirname, '..', '..', 'sondar-mobile', '.env.local'), override: false, quiet: true });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

function leerRolJwt(token) {
  try {
    const payload = JSON.parse(Buffer.from(String(token).split('.')[1] || '', 'base64url').toString('utf8'));
    return payload.role || null;
  } catch {
    return null;
  }
}

function pareceServiceRole(token) {
  if (!token) return false;
  return leerRolJwt(token) === 'service_role' || String(token).startsWith('sb_secret_');
}

if (!supabaseUrl || (!supabaseServiceRoleKey && !supabaseAnonKey)) {
  throw new Error('Faltan SUPABASE_URL y una API key de Supabase en el entorno del backend.');
}

const authClient = createClient(supabaseUrl, supabaseAnonKey || supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey || supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

supabaseAdmin.authClient = authClient;
supabaseAdmin.hasServiceRole = pareceServiceRole(supabaseServiceRoleKey);

module.exports = supabaseAdmin;
