# SONDAR Mobile

Cliente Expo para Android, iOS y Expo Go. En la rama existente `Mobile-Local` utiliza la API web y la instancia Supabase local configuradas desde la raíz. Las migraciones de `supabase/migrations` son las de la versión web y la única fuente de verdad.

## Requisitos

El proyecto utiliza Expo SDK 58, React 19.3 y React Native 0.88. Para desarrollo se usa Node 24 LTS, fijado en las imágenes Docker.

## Desarrollo local

Desde la raíz del repositorio, con Docker Desktop iniciado:

```powershell
npm ci
npm run son
npm run docker:logs
```

Escanea el QR de Metro con Expo Go en un teléfono conectado a la misma red que la PC. Para seleccionar la dirección Wi-Fi de la PC cuando haya varias interfaces, define `SONDAR_LAN_IP` antes de ejecutar el comando.

Detén el entorno conservando la base local:

```powershell
npm run docker:down
```

Consulta [la guía de Docker local](../docs/DOCKER_LOCAL_UNIFICADO.md) para puertos, variables y manejo de migraciones.

En desarrollo, la app usa el host del bundle de Metro para las llamadas `/api` y `/supabase`. No se configura `localhost` del teléfono como dirección de la PC.