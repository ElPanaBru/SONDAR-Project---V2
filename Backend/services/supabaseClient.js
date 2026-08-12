const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', 'Frontend', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabaseTimeoutMs = Number(process.env.SUPABASE_TIMEOUT_MS || 12000);

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno del backend.');
}

if (!supabaseAnonKey) {
  console.warn('Falta SUPABASE_ANON_KEY en el backend. Se usara SUPABASE_SERVICE_ROLE_KEY para validar auth.');
}

function crearFetchConTimeout(timeoutMs) {
  return async (input, init = {}) => {
    const controller = new AbortController();
    const upstreamSignal = init.signal;
    const timeout = setTimeout(() => {
      controller.abort(new Error('Supabase tardo demasiado en responder.'));
    }, timeoutMs);

    const abortarPorUpstream = () => controller.abort(upstreamSignal.reason);
    if (upstreamSignal) {
      if (upstreamSignal.aborted) {
        abortarPorUpstream();
      } else {
        upstreamSignal.addEventListener('abort', abortarPorUpstream, { once: true });
      }
    }

    try {
      return await fetch(input, {
        ...init,
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        const timeoutError = new Error('Supabase tardo demasiado en responder.');
        timeoutError.code = 'SUPABASE_TIMEOUT';
        timeoutError.cause = error;
        throw timeoutError;
      }
      throw error;
    } finally {
      clearTimeout(timeout);
      if (upstreamSignal) {
        upstreamSignal.removeEventListener('abort', abortarPorUpstream);
      }
    }
  };
}

function esJwtCompacto(valor) {
  return typeof valor === 'string' && valor.split('.').length === 3;
}

function opcionesServidor({ headers = {}, accessToken } = {}) {
  return {
    ...(accessToken ? { accessToken: async () => accessToken } : {}),
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      headers,
      fetch: crearFetchConTimeout(supabaseTimeoutMs)
    }
  };
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, opcionesServidor());

const supabaseAuth = createClient(
  supabaseUrl,
  supabaseAnonKey || supabaseServiceRoleKey,
  opcionesServidor()
);

function crearStorageAutenticado(accessToken) {
  if (!esJwtCompacto(accessToken)) {
    if (esJwtCompacto(supabaseServiceRoleKey)) return supabaseAdmin.storage;

    const error = new Error(
      'Storage requiere el token JWT del usuario cuando SUPABASE_SERVICE_ROLE_KEY usa una clave sb_secret.'
    );
    error.code = 'SUPABASE_STORAGE_TOKEN_REQUIRED';
    throw error;
  }

  return createClient(
    supabaseUrl,
    supabaseServiceRoleKey,
    opcionesServidor({ accessToken })
  ).storage;
}

module.exports = supabaseAdmin;
module.exports.authClient = supabaseAuth;
module.exports.crearStorageAutenticado = crearStorageAutenticado;
