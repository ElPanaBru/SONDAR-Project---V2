# SQL de mantenimiento

El historial completo está en `../../supabase/migrations`.

Esta carpeta conserva reparaciones específicas:

- `Desactivar_Trigger_Auth_Perfil.sql`: retira el trigger de alta legacy; el backend gestiona el perfil público.
- `Eliminar_Trigger_Compartidos_Legacy.sql`: retira un contador legacy; el backend calcula compartidos desde relaciones.
- `Permitir_Storage_Por_Usuario.sql`: políticas de propiedad/rutas para cargas autenticadas.

No hay un segundo instalador ni una lista para ejecutar alfabéticamente. Consultar [la guía de base](../../docs/BASE_DE_DATOS.md). El lanzador `db:aplicar` permite revisar y ensayar estas reparaciones explícitamente.
