const pool = require('../Pool_DB');
const reelController = require('../Controllers/reelController');
const usuarioController = require('../Controllers/usuarioController');

function ejecutarControlador(handler, req) {
  return new Promise((resolve, reject) => {
    let statusCode = 200;
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(body) {
        if (statusCode >= 400) {
          const error = new Error(body?.error || `HTTP ${statusCode}`);
          error.statusCode = statusCode;
          reject(error);
        } else {
          resolve(body);
        }
        return this;
      },
    };

    Promise.resolve(handler(req, res)).catch(reject);
  });
}

async function restaurarInteraccion({ table, counter, userId, reelId, existed }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (existed) {
      await client.query(
        `INSERT INTO ${table} (user_id, reel_id) VALUES ($1, $2) ON CONFLICT (user_id, reel_id) DO NOTHING`,
        [userId, reelId]
      );
    } else {
      await client.query(`DELETE FROM ${table} WHERE user_id = $1 AND reel_id = $2`, [userId, reelId]);
    }
    await client.query(
      `UPDATE reels SET ${counter} = (SELECT COUNT(*)::int FROM ${table} WHERE reel_id = $1) WHERE id = $1`,
      [reelId]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => null);
    throw error;
  } finally {
    client.release();
  }
}

async function verificarInteraccion({
  label,
  table,
  counter,
  endpointField,
  profileField,
  handler,
  user,
  reelId,
}) {
  const original = await pool.query(
    `SELECT EXISTS(SELECT 1 FROM ${table} WHERE user_id = $1 AND reel_id = $2) AS active`,
    [user.id, reelId]
  );
  const existed = Boolean(original.rows[0]?.active);
  const req = { params: { id: String(reelId) }, user };

  try {
    const toggled = await ejecutarControlador(handler, req);
    const expected = !existed;
    if (Boolean(toggled[endpointField]) !== expected) {
      throw new Error(`${label}: el endpoint devolvio un estado inesperado.`);
    }

    const profile = await ejecutarControlador(usuarioController.obtenerPerfilActual, { user });
    const visible = (profile[profileField] || []).some((item) => String(item.id) === String(reelId));
    if (visible !== expected) {
      throw new Error(`${label}: PostgreSQL cambio, pero el perfil no refleja la interaccion.`);
    }

    const restored = await ejecutarControlador(handler, req);
    if (Boolean(restored[endpointField]) !== existed) {
      throw new Error(`${label}: el segundo toggle no restauro el estado original.`);
    }

    const restoredProfile = await ejecutarControlador(usuarioController.obtenerPerfilActual, { user });
    const restoredVisible = (restoredProfile[profileField] || []).some(
      (item) => String(item.id) === String(reelId)
    );
    if (restoredVisible !== existed) {
      throw new Error(`${label}: el perfil no volvio al estado original.`);
    }

    return { label, persisted: true, visibleInProfile: true, restored: true };
  } finally {
    await restaurarInteraccion({ table, counter, userId: user.id, reelId, existed });
  }
}

async function verificarTogglesConcurrentes({
  label,
  table,
  counter,
  profileField,
  handler,
  user,
  reelId,
}) {
  const original = await pool.query(
    `SELECT EXISTS(SELECT 1 FROM ${table} WHERE user_id = $1 AND reel_id = $2) AS active`,
    [user.id, reelId]
  );
  const existed = Boolean(original.rows[0]?.active);
  const req = () => ({ params: { id: String(reelId) }, user });

  try {
    await Promise.all([
      ejecutarControlador(handler, req()),
      ejecutarControlador(handler, req()),
    ]);

    const databaseState = await pool.query(
      `SELECT
         EXISTS(SELECT 1 FROM ${table} WHERE user_id = $1 AND reel_id = $2) AS active,
         (SELECT ${counter} FROM reels WHERE id = $2)::int AS stored_count,
         (SELECT COUNT(*)::int FROM ${table} WHERE reel_id = $2) AS actual_count`,
      [user.id, reelId]
    );
    const row = databaseState.rows[0];
    if (Boolean(row.active) !== existed) {
      throw new Error(`${label}: dos toggles simultaneos no conservaron el estado original.`);
    }
    if (Number(row.stored_count) !== Number(row.actual_count)) {
      throw new Error(`${label}: el contador agregado quedo desfasado de la tabla de interacciones.`);
    }

    const profile = await ejecutarControlador(usuarioController.obtenerPerfilActual, { user });
    const visible = (profile[profileField] || []).some((item) => String(item.id) === String(reelId));
    if (visible !== existed) {
      throw new Error(`${label}: el perfil quedo desfasado tras toggles simultaneos.`);
    }

    return { label: `${label}-concurrente`, serialized: true, counterConsistent: true, restored: true };
  } finally {
    await restaurarInteraccion({ table, counter, userId: user.id, reelId, existed });
  }
}

async function main() {
  const integrity = await pool.query(
    `SELECT
       COUNT(*) FILTER (
         WHERE r.likes <> (SELECT COUNT(*)::int FROM reel_likes rl WHERE rl.reel_id = r.id)
       )::int AS mismatched_like_counters,
       COUNT(*) FILTER (
         WHERE r.guardados <> (SELECT COUNT(*)::int FROM reel_saves rs WHERE rs.reel_id = r.id)
       )::int AS mismatched_save_counters
     FROM reels r`
  );
  const databaseIntegrity = integrity.rows[0];
  if (databaseIntegrity.mismatched_like_counters || databaseIntegrity.mismatched_save_counters) {
    throw new Error(`Hay contadores desfasados: ${JSON.stringify(databaseIntegrity)}`);
  }

  const sample = await pool.query(
    `SELECT r.id AS reel_id, u.id, u.email, u.username
     FROM reels r
     JOIN users u ON u.id = r.creador_id
     ORDER BY r.id
     LIMIT 1`
  );
  if (sample.rowCount === 0) {
    throw new Error('No hay un reel con creador para ejecutar la comprobacion reversible.');
  }

  const row = sample.rows[0];
  const user = {
    id: row.id,
    email: row.email,
    user_metadata: { username: row.username },
  };
  const reelId = row.reel_id;

  const results = [];
  results.push(await verificarInteraccion({
    label: 'like',
    table: 'reel_likes',
    counter: 'likes',
    endpointField: 'liked',
    profileField: 'favoritos',
    handler: reelController.alternarLike,
    user,
    reelId,
  }));
  results.push(await verificarTogglesConcurrentes({
    label: 'like',
    table: 'reel_likes',
    counter: 'likes',
    profileField: 'favoritos',
    handler: reelController.alternarLike,
    user,
    reelId,
  }));
  results.push(await verificarTogglesConcurrentes({
    label: 'guardado',
    table: 'reel_saves',
    counter: 'guardados',
    profileField: 'guardados',
    handler: reelController.alternarGuardado,
    user,
    reelId,
  }));
  results.push(await verificarInteraccion({
    label: 'guardado',
    table: 'reel_saves',
    counter: 'guardados',
    endpointField: 'guardado',
    profileField: 'guardados',
    handler: reelController.alternarGuardado,
    user,
    reelId,
  }));

  console.log(JSON.stringify({ databaseIntegrity, reelId, results }, null, 2));
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
