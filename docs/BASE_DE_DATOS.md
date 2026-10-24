# Base de datos de SONDAR

## Fuentes y administración personal

`supabase/migrations` es el único historial de instalación y evolución. Los SQL siguen siendo editables: para un cambio nuevo, agregar otra migración con prefijo temporal, revisarla y aplicarla explícitamente. Los archivos ya compartidos se conservan para reproducir la misma instalación en otros equipos.

`shared/generos.json` define los siete géneros, sin Metal. El seed lo refleja y `npm run db:validar` detecta diferencias. Agregar o retirar categorías requiere revisar también referencias y restricciones SQL; editar solo el JSON no migra contenido existente.

Se admiten tablas y columnas personales. `Backend/database/verificarContrato.js` comprueba los mínimos necesarios, sin exigir un número exacto de tablas ni borrar objetos adicionales. La migración retira las tres tablas legacy de comunidades en inglés y preferencias antiguas únicamente si están vacías y sin dependencias personales. Si tienen datos, aborta para que se resuelva su traslado.

## Instalación nueva

Con Docker iniciado, desde la raíz:

```powershell
npx supabase start
```

Completar los `.env` con los valores del proyecto. Para reproducir las migraciones y el seed en una base local descartable puede usarse `npx supabase db reset`; ese comando elimina su contenido existente. No es un paso necesario para actualizar una base con datos.

Los puertos y buckets están en `supabase/config.toml`. El snapshot necesita los esquemas de Supabase: no es un instalador para PostgreSQL sin Auth/Storage/Realtime.

## Actualización conservando datos

### CLI de Supabase

```powershell
npx supabase migration list --local
npx supabase migration up --local
```

Para otros entornos, revisar el proyecto enlazado y su historial antes de utilizar el flujo remoto de la CLI. Esa actualización debe ser una acción explícita del operador.

### Herramienta manual local

```powershell
npm run db:actualizar -- --dry-run
npm run db:actualizar
npm run db:verificar
```

La herramienta aplica `20261022120000_alinear_catalogo_y_contrato.sql` y luego `20261023120000_conservar_recuperacion_cuentas.sql` en la misma transaccion. Abre una sola transacción, bloquea las tablas de aplicación existentes, respalda filas/restricciones/políticas y comprueba que se conserven las entidades y guardados ajenos a Metal. El ensayo y los errores terminan en rollback.

Su respaldo JSON no sustituye un backup completo de PostgreSQL. Para ese respaldo existe `db:respaldar`, que usa `pg_dump`. Los binarios de Storage y la configuración externa se respaldan por separado.

El comando manual no registra versiones en `supabase_migrations.schema_migrations`. La migración de alineación es reaplicable, pero las migraciones anteriores deben estar registradas antes de combinar herramientas: algunos pasos históricos requieren las tablas legacy que la limpieza retira. En una base que solo tenga el snapshot registrado, utilizar primero `migration up --local`, como se hizo en esta limpieza. No marcar versiones como aplicadas sin comprobar el esquema.

Las equivalencias de géneros conocidas se conservan. Metal se elimina junto con su contenido por decisión explícita: incluye eventos o previews con Metal como género principal o secundario, publicaciones relacionadas y sus dependencias. Reggae con referencias aborta y pide reclasificación manual. Las dependencias personales desconocidas deben detener la eliminación mediante sus FK.

## Inspección y mantenimiento específico

```powershell
npm run db:verificar
npm run db:aplicar --prefix Backend -- --list
npm run db:aplicar --prefix Backend -- Permitir_Storage_Por_Usuario.sql --dry-run
```

`db:verificar` es de solo lectura. Comprueba tablas/columnas mínimas y catálogo. Las pruebas funcionales de permisos, Auth, Storage y Realtime siguen siendo necesarias en el entorno de destino.

`db:aplicar` acepta un nombre del historial o uno de los tres SQL de mantenimiento. Valida el nombre antes de conectarse, ejecuta una transacción y permite `--dry-run`. No ejecutar el snapshot inicial sobre un esquema ya instalado.

Se conservan los alias de los tres SQL de octubre idénticos a migraciones. Mantienen sus efectos originales: un alias parcial no ejecuta una actualización global distinta. Los otros instaladores retirados fallan con una indicación de consultar esta guía.

`aplicarEsquemaMinimo.js` queda como alias de verificación de solo lectura. Sus modos destructivos anteriores fueron retirados.

## Compatibilidad con Ultime_Ver_Funcional (2026-10-23)

Se conserva sin cambios la migracion historica `20261015193000_catalogo_ocho_generos.sql`. En instalaciones nuevas se ejecuta en su orden temporal, antes de la alineacion final de siete generos. No borrar ni renumerar versiones ya aplicadas para hacer coincidir dos ramas; revisar el historial real antes de actualizar.

La migracion aditiva `20261023120000_conservar_recuperacion_cuentas.sql` incorpora dos columnas opcionales en `public.users`: `deletion_requested_at` y `deletion_scheduled_at`. Conserva el plazo de recuperacion de siete dias de la rama de origen, tambien con esquema manual. No programa bajas ni elimina datos. Se puede reaplicar; necesita un bloqueo breve de ALTER TABLE. El contrato comprueba estos campos y onboarding.

Para revertir el codigo de cuentas, conservar las columnas hasta que no existan bajas pendientes ni consumidores. Solo entonces una nueva migracion revisada podria retirarlas; no eliminarlas mientras haya solicitudes pendientes.

La incorporacion del codigo no aplica el retiro de Metal a ninguna base real. Esa operacion elimina contenido y requiere revisar el destino y autorizarla expresamente. Las validaciones de esta integracion se hicieron con datos ficticios en una base temporal.

## Elegir quién administra el DDL

En `Backend/.env`, `SONDAR_SCHEMA_MODE=compatible` es el valor por defecto: conserva las reparaciones idempotentes de instalaciones previas. Ya no retira preferencias antiguas automáticamente al arrancar.

`SONDAR_SCHEMA_MODE=manual` omite esos inicializadores para administrar el esquema mediante SQL. Reiniciar el backend tras cambiar el modo. El registro y las operaciones de usuarios siguen escribiendo datos normalmente; tener el esquema actualizado es responsabilidad del operador. Este modo no aplica migraciones al arrancar.

## Prueba aislada reproducible

```powershell
python Backend/scripts/probarMigracionesAisladas.py
```

Requiere Python y Docker local. Crea una base vacía temporal en PostgreSQL de Supabase, copia solo definiciones auxiliares y usa datos ficticios. Finalmente elimina exclusivamente la base temporal. Puede configurarse `SONDAR_TEST_CONTAINER` y `SONDAR_TEST_DB_USER`.

No se ejecuta dentro de `npm run verify`: es una operación de infraestructura que el operador elige. Cubre instalación, reaplicación, catálogo viejo, conservación de entidades/guardados, tabla personal, ausencia de preferencias legacy, respuestas sin seguimiento, rechazo ante bloqueo y retiro de Metal con su contenido, eliminaci?n de tablas legacy vac?as y rollback ante categor?as referenciadas o tablas legacy con datos. No sustituye pruebas de los servicios externos ni de una base real con su carga particular.

Los audios e imágenes de Storage no se eliminan con SQL. Antes de retirar previews en un entorno con contenido de Metal, guardar sus `audio_path`/`portada_path` y retirarlos mediante la API de Storage; no borrar directamente sus filas internas. El respaldo del actualizador conserva esos datos. En la base local limpiada no había previews de Metal ni archivos asociados que retirar.
