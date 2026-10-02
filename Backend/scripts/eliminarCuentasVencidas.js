const pool = require('../Pool_DB');
const supabase = require('../services/supabaseClient');
const supabaseAuth = supabase.authClient || supabase;

const INTERVALO_MS = 60 * 60 * 1000;
let ejecutando = false;

async function eliminarCuentasVencidas() {
  if (ejecutando) return;
  ejecutando = true;
  try {
    const pendientes = await pool.query(`
      SELECT id FROM public.users
      WHERE deletion_scheduled_at <= now()
      ORDER BY deletion_scheduled_at
      LIMIT 100
    `);
    for (const { id } of pendientes.rows) {
      const { error } = await supabaseAuth.auth.admin.deleteUser(id);
      if (error && !/not found|user does not exist/i.test(error.message || '')) {
        console.error(`No se pudo eliminar la cuenta vencida ${id}:`, error);
      }
    }
  } catch (error) {
    console.error('No se pudieron procesar las cuentas vencidas:', error);
  } finally {
    ejecutando = false;
  }
}

function iniciarEliminacionCuentasVencidas() {
  eliminarCuentasVencidas();
  const timer = setInterval(eliminarCuentasVencidas, INTERVALO_MS);
  timer.unref?.();
}

module.exports = { iniciarEliminacionCuentasVencidas, eliminarCuentasVencidas };
