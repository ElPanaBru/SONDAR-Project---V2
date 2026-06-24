const supabase = require('../services/supabaseClient');

async function authMiddleware(req, res, next) {
  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : '';

  if (!token) {
    return res.status(401).json({ error: 'Token de autenticacion requerido.' });
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return res.status(401).json({ error: 'Token de autenticacion invalido.' });
  }

  req.user = data.user;
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

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    req.user = null;
    return next();
  }

  req.user = data.user;
  next();
};

module.exports = authMiddleware;
