# Desarrollo móvil en `Mobile-Local`

La rama existente `Mobile-Local` conserva el cliente Expo y usa la API web y el proyecto Supabase local de `Web_BDD_Local`. La carpeta `supabase/migrations` coincide con la versión web; la migración `20261030120000_compatibilidad_mobile.sql` no forma parte de este entorno.

## Inicio

Requisitos: Docker Desktop con contenedores Linux, Docker Compose 2.24 o posterior y Node 24 LTS.

Desde la raíz de `Mobile-Local`:

```powershell
npm ci
npm run son
```

`npm run son` inicia el proyecto Supabase web y los servicios `api`, `web` y `mobile` de Compose. `npm run dev` desde la raíz inicia el mismo stack compartido. Escanea el QR que aparece en los logs de Metro con Expo Go en un teléfono conectado a la misma red que la PC. La primera ejecución descarga las imágenes y paquetes; las posteriores conservan el volumen de PostgreSQL.

Si la PC tiene varias interfaces de red, define primero la IPv4 Wi-Fi:

```powershell
$env:SONDAR_LAN_IP = '192.168.1.25'
npm run son
```

## Servicios locales

| Servicio | Dirección |
| --- | --- |
| Web Vite | http://localhost:3001 |
| API web | http://localhost:3000 |
| Supabase Auth / REST / Storage | http://localhost:54321 |
| PostgreSQL | 127.0.0.1:55432 |
| Supabase Studio | http://localhost:54323 |
| Expo Metro | http://<SONDAR_LAN_IP>:8081 |

El proyecto Supabase usa `project_id = SONDAR-Project---V2`, igual que la versión web. Por eso web y móvil arrancados desde esta branch llegan al mismo PostgreSQL y al mismo historial de migraciones.

## Comandos

```powershell
npm run docker:status
npm run docker:logs
npm run docker:down
```

`docker:down` detiene Compose y Supabase sin borrar los volúmenes. Los cambios nuevos de esquema se agregan a `supabase/migrations` siguiendo el flujo web. No ejecutar `supabase db reset --local` sobre datos que quieras conservar: reconstruye la base local.

Guía completa: [web y móvil en Docker](DOCKER_LOCAL_UNIFICADO.md).