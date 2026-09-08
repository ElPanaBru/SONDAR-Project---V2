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

async function confirmarPasswordEliminacion(req, res, next) {
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!password) {
    return res.status(400).json({ error: 'Ingresa tu contrasena para confirmar la eliminacion.' });
  }

  if (!req.user?.email) {
    return res.status(400).json({ error: 'Tu cuenta no tiene un email disponible para verificar la contrasena.' });
  }

  try {
    const { data, error } = await supabaseAuth.auth.signInWithPassword({
      email: req.user.email,
      password,
    });

    if (error || String(data.user?.id) !== String(req.user.id)) {
      return res.status(401).json({ error: 'La contrasena es incorrecta.' });
    }

    return next();
  } catch (error) {
    console.error('Error al confirmar la contrasena para eliminar contenido:', error);
    const status = esTimeoutSupabase(error) ? 503 : 500;
    const mensaje = status === 503
      ? 'El servicio de autenticacion tardo demasiado. Proba de nuevo.'
      : 'No se pudo verificar la contrasena.';
    return res.status(status).json({ error: mensaje });
  }
}

module.exports = confirmarPasswordEliminacion;
