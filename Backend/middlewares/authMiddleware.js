const pool = require('../Pool_DB');
const supabase = require('../services/supabaseClient');
const supabaseAuth = supabase.authClient || supabase;

async function authMiddleware(req, res, next) {
  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : '';

  if (!token) {
    return res.status(401).json({ error: 'Token de autenticacion requerido.' });
  }

  const { data, error } = await supabaseAuth.auth.getUser(token);

  if (error || !data.user) {
    return res.status(401).json({ error: 'Token de autenticacion invalido.' });
  }

  try {
    const profile = await pool.query('SELECT id FROM users WHERE id = $1', [data.user.id]);
    if (!profile.rowCount) return res.status(403).json({ code: 'PROFILE_MISSING', error: 'Esta cuenta ya no tiene un perfil SONDAR activo.' });
  } catch (error) {
    console.error('No se pudo validar el perfil:', error);
    return res.status(503).json({ error: 'No se pudo verificar la cuenta. Intentá nuevamente.' });
  }

  req.user = data.user;
  req.accessToken = token;
  next();
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

  const { data, error } = await supabaseAuth.auth.getUser(token);

  if (error || !data.user) {
    return res.status(401).json({ error: 'Token de autenticacion invalido.' });
  }

  try {
    const profile = await pool.query('SELECT id FROM users WHERE id = $1', [data.user.id]);
    if (!profile.rowCount) return res.status(403).json({ code: 'PROFILE_MISSING', error: 'Esta cuenta ya no tiene un perfil SONDAR activo.' });
  } catch (error) {
    console.error('No se pudo validar el perfil:', error);
    return res.status(503).json({ error: 'No se pudo verificar la cuenta. Intentá nuevamente.' });
  }

  req.user = data.user;
  req.accessToken = token;
  next();
};

module.exports = authMiddleware;
