# SONDAR movil con base local

La rama `Mobile-Local` reutiliza las migraciones de `Web_BDD_Local` y agrega `20261030120000_compatibilidad_mobile.sql`: el backend movil todavia necesita las tablas de preferencias y publicaciones de perfil que la web retiro. No se reemplazan sus controladores por los de la web.

## Primer inicio

Requisitos: Docker Desktop funcionando con contenedores Linux y Node 24 LTS (24.3 o posterior). El SDK de Expo de este proyecto no admite Node 25.

Desde la raiz:

```powershell
npm ci
npm ci --prefix Backend
npm ci --prefix sondar-mobile
npm run dev:mobile:clear
```

Escanear el QR de Expo Go. En LAN, PC y celular deben estar en la misma red. La primera ejecucion puede descargar imagenes Docker; los siguientes arranques usan los datos del volumen local. Para usar el tunel de Expo: `npm run dev:mobile:tunnel:clear`.

El comando inicia Supabase, aplica solo migraciones pendientes y genera las variables locales antes de iniciar API y Expo. La clave administrativa permanece en `Backend/.env.local`; la app recibe solamente la clave publica. Los `.env` anteriores se conservan, pero no se usan en este arranque. No copiar claves de la nube a los ejemplos.

## Servicios

| Servicio | Direccion en la PC |
| --- | --- |
| Expo / proxy para el celular | http://localhost:8081 |
| API SONDAR | http://127.0.0.1:3000 |
| Supabase API / Auth / Storage | http://127.0.0.1:55321 |
| PostgreSQL | 127.0.0.1:55322 |
| Supabase Studio | http://127.0.0.1:55323 |
| Correo de pruebas | http://127.0.0.1:55324 |

Proyecto Docker: `sondar-mobile-local`. Utiliza puertos y volumen propios; no comparte los datos de `SONDAR-Project---V2` usados por la web. La instalacion nueva contiene el catalogo y comunidades; crear una cuenta local para probar. Los usuarios y binarios de Storage remotos no forman parte de las migraciones.

Auth y los archivos del celular pasan por `/supabase` en Expo. La app adapta las URLs de Storage de la PC al servidor Expo alcanzable desde el dispositivo, y mantiene una sesion local separada de la nube.

## Uso diario y migraciones

```powershell
npm run dev:mobile
npm run local:status
npm run local:stop
```

Detener los servicios conserva los datos. `local:stop` detiene Supabase; cerrar Expo y el backend por separado cuando corresponda.

El historial esta en `supabase/migrations`; `supabase/seed.sql` contiene el catalogo inicial y `config.toml` configura los buckets. Para cambios nuevos:

```powershell
npx supabase migration new descripcion_del_cambio
# Editar el nuevo SQL y revisarlo.
npm run db:history
npm run db:migrate
```

`db:migrate` utiliza `--local`. El arranque no ejecuta `db reset`, `db push` ni enlaza proyectos remotos. `supabase db reset --local` es exclusivamente para reconstruir una base local descartable: borra su contenido y reaplica migraciones y seed.

Las tablas adicionales de publicaciones de perfil estan protegidas con RLS y se acceden por la API del backend. Las preferencias conservan politicas por usuario. Los buckets `perfiles`, `eventos` y `reels` usan las politicas del historial de la web.

## Verificacion

```powershell
npm test --prefix Backend
npm test --prefix sondar-mobile
npm run typecheck --prefix sondar-mobile
```

Guia de referencia: [migraciones de Supabase](https://supabase.com/docs/guides/deployment/database-migrations).
