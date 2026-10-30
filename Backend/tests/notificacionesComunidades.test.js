const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');

const actorId = '11111111-1111-4111-8111-111111111111';
const miembroUno = '22222222-2222-4222-8222-222222222222';
const miembroDos = '33333333-3333-4333-8333-333333333333';
const inserciones = [];
let consultaMiembros = '';

const poolFalso = {
  async query(sql, params = []) {
    const consulta = String(sql).replace(/\s+/g, ' ').trim();
    if (consulta.startsWith('SELECT cm.user_id FROM comunidad_miembros')) {
      consultaMiembros = consulta;
      assert.deepEqual(params, ['pop', actorId, 'todas']);
      return {
        rows: [{ user_id: miembroUno }, { user_id: miembroDos }],
        rowCount: 2,
      };
    }
    if (consulta.startsWith('INSERT INTO notifications')) {
      inserciones.push({ consulta, params });
      return { rows: [{ id: inserciones.length }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  },
};

const originalLoad = Module._load;
Module._load = function cargarModulo(request, parent, isMain) {
  if (request === '../Pool_DB') return poolFalso;
  return originalLoad.call(this, request, parent, isMain);
};
const { notificarMiembrosComunidad } = require('../services/notificationService');
Module._load = originalLoad;

test('una publicacion nueva notifica a cada miembro de la comunidad excepto al autor', async () => {
  const cantidad = await notificarMiembrosComunidad({
    comunidadId: 'pop',
    actorId,
    title: 'Nueva publicacion en Pop',
    body: 'Tester: Publicacion de prueba',
    targetUrl: '/comunidad?comunidad=pop&publicacion=41',
    uniquePrefix: 'new-community-post:41',
  });

  assert.equal(cantidad, 2);
  assert.match(consultaMiembros, /cm\.user_id <> \$2/);
  assert.match(consultaMiembros, /nivel_notificaciones/);
  assert.deepEqual(inserciones.map(({ params }) => params[0]), [miembroUno, miembroDos]);
  assert.deepEqual(
    inserciones.map(({ params }) => params[6]),
    [`new-community-post:41:${miembroUno}`, `new-community-post:41:${miembroDos}`]
  );
  inserciones.forEach(({ consulta, params }) => {
    assert.equal(params[2], 'new_community_post');
    assert.match(consulta, /notificar_publicaciones/);
  });
});
