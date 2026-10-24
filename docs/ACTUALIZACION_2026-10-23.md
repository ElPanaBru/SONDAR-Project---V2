# Actualizacion de Ultime_Ver_Funcional — 2026-10-23

## Referencias y alcance

Origen: rama `Ultime_Ver_Funcional`, commit `11423cbd57bc01e6f1da119f3930e71de90c9e3d`, sin cambios locales al comenzar.
Referencia incorporada: `4d8826bdabf5e6db81a69ef50bdc52d80cc5a447` de `Web_BDD_Local`.

Se integraron los cambios de la referencia en el arbol de trabajo; no se cambio la rama ni se creo un commit. La integracion combina ambas ramas, no es una sustitucion ciega del historial.

## Cambios incorporados

- Algoritmo modular de Descubrir: configuracion, puntuacion, diversificacion, adaptador de intereses/likes/guardados/seguimientos, endpoint `/api/reels/descubrir`, uso desde el feed y pruebas.
- Cambios de navegacion y onboarding, busqueda sin texto, comunidades, presentacion de eventos, denuncias, preferencias y sus imports compartidos.
- Recursos visuales de la referencia, incluido el banner de rock; retiro de recursos y pantallas obsoletos.
- Catalogo compartido de siete generos, migraciones canonicas, seed y herramientas de contrato, respaldo, actualizacion y validacion de base.
- Scripts de desarrollo, pruebas, lint y build, limpieza de dependencias y documentacion tecnica. Instalacion exacta con `npm ci` en raiz, Backend y Frontend.
- Retiro de instaladores SQL duplicados, informes antiguos y scripts obsoletos siguiendo la referencia. Los archivos retirados siguen recuperables en el commit de origen.

## Correcciones de la rama actual conservadas

- Recuperacion de cuentas durante siete dias, ruta de recuperacion, prevalidacion de registro y verificacion de cuentas existentes en Auth.
- Nombre de usuario al crear el perfil publico y correcciones previas de perfiles.
- Soporte mediante apiJson, comprobacion del correo y creacion diferida del cliente de correo.
- Manejo de errores de sesion y configuracion de API de la rama de origen.
- Health sin exposicion de configuracion interna.
- Archivos de entorno, uploads, datos locales y caches moviles conservados. No se incorporaron sus valores al informe.
- Migracion historica `20261015193000_catalogo_ocho_generos.sql` preservada sin cambios. Las migraciones existentes no se reescribieron.

## Compatibilidad adicional de cuentas

Nueva migracion `20261023120000_conservar_recuperacion_cuentas.sql`: agrega solamente `users.deletion_requested_at` y `users.deletion_scheduled_at` si faltan. No elimina ni programa cuentas. El contrato verifica estos campos y onboarding; el actualizador manual aplica esta migracion despues de la alineacion del catalogo.

Se sustituyo la prueba estatica incompatible de borrado inmediato por pruebas de comportamiento de programacion, autenticacion, errores de base, recuperacion e informacion de perfil. La suite SQL ahora identifica explicitamente la migracion de alineacion, en vez de asumir que siempre es la ultima.

## Validacion realizada

- `npm run verify`: correcto; 119 pruebas backend y 3 frontend, validacion offline del catalogo/SQL, ESLint y build Vite.
- Build con advertencia por el tamano del bundle, sin errores de compilacion.
- Instalacion completa de siete migraciones y seed en una base temporal del contenedor Supabase local, con datos ficticios. Verificados reaplicacion, normalizacion, conservacion de entidades/guardados, tablas personales, RLS, bloqueos, rechazo de tablas legacy con datos y rollback ante Reggae referenciado. Tambien se probo el retiro de Metal exclusivamente sobre fixtures ficticios y la migracion de cuentas reaplicable.
- El runner Python no estaba disponible en este equipo. Se ejecuto un driver Node temporal equivalente, reutilizando los fixtures de la suite SQL. Evidencia local ignorada por Git: `tmp/validar-integracion-sql.cjs`, `tmp/actualizacion-sql.log` y `tmp/actualizacion-verify-final.log`.
- La base temporal se elimino al terminar.

## Base local y limites

Se inspecciono en modo de solo lectura el contrato del contenedor `supabase_db_SONDAR-Project---V2`. Ya tenia todas las tablas y el catalogo de siete generos; solo faltaban los dos campos de recuperacion.

Se aplico unicamente la migracion aditiva de cuentas a esa base local y se verifico luego el contrato completo: correcto, sin tablas ni columnas faltantes. No se ejecuto limpieza ni retiro de contenido sobre la base de la aplicacion. No se conecto a bases remotas.

La aplicacion directa de esta migracion no registra una version en `supabase_migrations.schema_migrations`; es idempotente. Antes de usar la CLI para actualizar otros entornos, revisar su historial real, incluida la migracion historica conservada de la rama vieja. No marcar como ejecutadas migraciones cuyo efecto no se haya verificado.

La configuracion del backend se conservo. Verificar que el entorno elegido apunte a la base deseada antes de iniciarlo; no se arranco el backend contra un destino desconocido ni se hicieron pruebas de extremo a extremo con cuentas reales, envio de correo o Storage. Esta revision del contrato local no acredita el esquema de otro destino configurado.

No se restauro una app movil: la referencia no contiene fuentes de Expo mantenidas.
