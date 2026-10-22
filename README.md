# SONDAR

Aplicacion de musica y comunidades: React/Vite en Frontend, API Express/PostgreSQL en Backend, catalogo en shared y esquema versionado en supabase.

## Preparar un equipo nuevo

Requisitos: Node compatible con Vite 8, npm y un proyecto Supabase local o remoto. Docker es necesario para Supabase local.

```powershell
npm ci
npm ci --prefix Backend
npm ci --prefix Frontend
Copy-Item Backend/.env.example Backend/.env
Copy-Item Frontend/.env.example Frontend/.env
```

Completar los valores del entorno elegido. Copiar los ejemplos solo en equipos nuevos: no sobrescribir los .env que ya funcionan. Los archivos de configuracion locales no deben versionarse.

```powershell
npm run dev
```

Frontend en http://localhost:3001; API en http://localhost:3000. start:all es un alias del mismo arranque. Para la red local existe dev:all:lan.

## Comprobar cambios

```powershell
npm run verify
```

Valida catalogo/archivos SQL offline, pruebas de ambos paquetes, lint del frontend y compilacion. No conecta a una base ni aplica migraciones. Tambien existen npm test, npm run lint y npm run build; la compilacion se genera en Frontend/dist.

## Base y control manual

La guia vigente es [docs/BASE_DE_DATOS.md](docs/BASE_DE_DATOS.md). El historial canonico esta en supabase/migrations. Los tres SQL de Backend/BDD-Sql son mantenimiento especifico, no otro instalador completo.

```powershell
npm run db:validar
npm run db:verificar
npm run db:actualizar -- --dry-run
```

El primero es offline, el segundo verifica el contrato real en una transaccion de solo lectura y el tercero ensaya la actualizacion unicamente en una base local. Para confirmarla: npm run db:actualizar sin --dry-run. Antes guarda un respaldo de tablas de aplicacion en Backend/backups.

Descargar codigo, compilar o iniciar Express no aplica las nuevas migraciones. SONDAR_SCHEMA_MODE=compatible conserva reparaciones de esquema de instalaciones previas. SONDAR_SCHEMA_MODE=manual las desactiva para administrar el DDL personalmente mediante SQL. El modo manual requiere el esquema instalado/verificado. Los campos personales adicionales no se retiran automaticamente al iniciar.

## Otras herramientas

- npm run db:respaldar --prefix Backend: pg_dump utiliza el .env del backend y guarda el respaldo en Backend/backups. Storage requiere un respaldo separado de sus archivos.
- npm run storage:orphans --prefix Backend: inspeccion de Storage. Su variante storage:orphans:delete si elimina objetos detectados.
- [docs/mapas.md](docs/mapas.md): configuracion opcional de Jawg/OpenFreeMap.
- [docs/LIMPIEZA_2026-10-22.md](docs/LIMPIEZA_2026-10-22.md): cambios, validaciones y limites.
