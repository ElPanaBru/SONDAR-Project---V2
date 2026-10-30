const supabase = require('../services/supabaseClient');
const supabaseAuth = supabase.authClient || supabase;

function esTimeoutSupabase(error) {
  const mensaje = String(error?.message || '').toLowerCase();
  return error?.code === 'SUPABASE_TIMEOUT'
    || error?.name === 'AbortError'
    || mensaje.includes('upstream request timeout')
    || mensaje.includes('tardo demasiado')
    || mensaje.includes('timeout');
}

async function authMiddleware(req, res, next) {
  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : '';

  if (!token) {
    return res.status(401).json({ error: 'Token de autenticacion requerido.' });
  }

  try {
    const { data, error } = await supabaseAuth.auth.getUser(token);

    if (error || !data.user) {
      return res.status(401).json({ error: 'Token de autenticacion invalido.' });
    }

    req.user = data.user;
    req.accessToken = token;
    next();
  } catch (error) {
    console.error('Error al validar token:', error);
    const status = esTimeoutSupabase(error) ? 503 : 500;
    const mensaje = status === 503
      ? 'El servicio de autenticacion tardo demasiado. Proba de nuevo.'
      : 'No se pudo validar la sesion.';
    res.status(status).json({ error: mensaje });
  }
}

authMiddleware.opcional = async function authOpcional(req, res, next) {
  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : '';

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const { data, error } = await supabaseAuth.auth.getUser(token);

    if (error || !data.user) {
      return res.status(401).json({ error: 'Token de autenticacion invalido.' });
    }

    req.user = data.user;
    req.accessToken = token;
    next();
  } catch (error) {
    console.error('Error al validar token opcional:', error);
    const status = esTimeoutSupabase(error) ? 503 : 500;
    const mensaje = status === 503
      ? 'El servicio de autenticacion tardo demasiado. Proba de nuevo.'
      : 'No se pudo validar la sesion.';
    res.status(status).json({ error: mensaje });
  }
};

module.exports = authMiddleware;
