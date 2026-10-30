# Desarrollo local web y móvil con Docker

La implementación vive en la rama existente `Mobile-Local`. Conserva el cliente Expo, usa la API web de `Web_BDD_Local` y mantiene las migraciones web como única fuente de verdad.

## Arquitectura

```text
Navegador ── localhost:3001 ── Vite ── localhost:3000 ──┐
                                                       API ── Supabase/Kong ── PostgreSQL
Teléfono ── LAN_IP:8081 ── Metro ── /api y /supabase ──┘
```

Supabase lo inicia el CLI del repositorio en la red Docker `sondar-local`. Compose agrega Vite, la API web y Metro a esa misma red. La API se conecta al PostgreSQL y Kong de Supabase por DNS interno; navegador y teléfono acceden a direcciones de host. La API y Vite se publican solo en loopback. Metro se publica únicamente en la IPv4 de red elegida para que Expo Go alcance el teléfono.

## Requisitos y arranque

1. Iniciar Docker Desktop y abrir PowerShell en la raíz de este worktree.
2. Usar Docker Compose 2.24 o posterior y disponer de al menos 7 GB de memoria asignada a Docker para el stack Supabase completo. La comparación previa registró 7,4 GiB disponibles para Docker en esta PC; si aparecen reinicios o falta memoria, cerrar el emulador y otros procesos pesados antes de ampliar esa asignación.
3. Instalar las dependencias raíz, incluido el Supabase CLI fijado en `package-lock.json`:

   ```powershell
   npm ci
   ```

4. Desde `Mobile-Local`, iniciar la base y los tres servicios de aplicación. `npm run son` es el comando móvil habitual; `npm run dev` desde la misma rama inicia exactamente el mismo Compose compartido:

   ```powershell
   npm run son
   ```

   Para iniciar el mismo stack desde el flujo web, usar `npm run dev`. `npm run docker:up` inicia el stack sin limpiar la caché de Metro; ambos comandos llegan al mismo proyecto Compose y al mismo `project_id` de Supabase.

5. Consultar el QR y los mensajes de Metro:

   ```powershell
   npm run docker:logs
   ```

   En el teléfono, abrir Expo Go y escanear el QR usando la misma red local de la PC. Si la PC tiene varias interfaces, elegir la IPv4 de Wi-Fi manualmente antes del arranque:

   ```powershell
   $env:SONDAR_LAN_IP = '192.168.1.25'
   npm run docker:up
   ```

6. Ver estado y detener sin borrar datos:

   ```powershell
   npm run docker:status
   npm run docker:down
   ```

`docker:down` detiene solo los servicios de aplicación y el proyecto Supabase identificado por `supabase/config.toml`. Conserva volúmenes; no ejecutar `docker compose down -v` ni `supabase stop --no-backup` para este flujo.

## Puertos

| Servicio | Dirección en la PC | Uso |
| --- | --- | --- |
| Web Vite | `http://localhost:3001` | Navegador de la PC |
| API Express | `http://localhost:3000` | Navegador y chequeo local |
| Supabase API | `http://localhost:54321` | Auth, REST y Storage desde la PC |
| Supabase Studio | `http://localhost:54323` | Administración de la base local |
| Metro | `http://<SONDAR_LAN_IP>:8081` | Expo Go y proxy móvil |

El script crea la red Docker con `com.docker.network.bridge.host_binding_ipv4=127.0.0.1` antes de iniciar Supabase. Comprueba que los puertos publicados de PostgreSQL/Kong estén limitados a localhost. Si Docker los publica fuera de loopback, detiene solo el proyecto Supabase y conserva sus volúmenes; no inicia Compose. No configura reglas de Windows Firewall. Si el perfil de red bloquea Metro, permitir únicamente el puerto 8081 en la interfaz privada necesaria; no abrir los puertos de PostgreSQL, Kong ni API a toda la red.

En esta PC, Docker Desktop informó `0.0.0.0` para PostgreSQL y Kong a pesar de esa configuración; por eso el arranque se aborta de forma segura. El detalle está en [la comparación previa](DOCKER_PREFLIGHT_2026-10-30.md). La validación no debe quitarse ni iniciarse la base hasta contar con un bind local efectivo.

## Base de datos y migraciones

La raíz Supabase de este worktree contiene el `config.toml` y las migraciones web. `docker:up` inicia Supabase con `--network-id sondar-local` y ejecuta explícitamente `supabase migration up --local`; así aplica solo las migraciones web pendientes en el volumen asociado al `project_id`. El volumen web existente se conserva entre arranques. La migración móvil `20261030120000_compatibilidad_mobile.sql` no se incluye ni se aplica; no se ejecuta `db reset`.

Los cambios nuevos de esquema se agregan y revisan primero en `supabase/migrations` de la rama web. No crear otra API móvil ni copiar su backend para este entorno: ambos clientes consumen la misma API Express web. El modo del backend queda en `SONDAR_SCHEMA_MODE=manual` para que la API no repare el esquema al arrancar.

## Entornos y claves

`docker:up` lee el estado JSON del CLI sin imprimirlo y genera dos archivos ignorados por Git:

- `Backend/.env.docker.local`: contraseña local de PostgreSQL y claves usadas solo por la API.
- `.env.docker.public`: claves publicables y URLs para Vite/Expo.

Compose pasa la clave secreta exclusivamente al servicio `api`. La web y el bundle móvil reciben solo la clave publicable. Los bind mounts reemplazan los `.env` de desarrollo dentro de los contenedores con `docker/empty.env`; así no se cargan configuraciones personales del host.

La API usa `SUPABASE_URL` con el hostname interno de Kong y `SUPABASE_PUBLIC_URL=http://localhost:54321` al formar enlaces públicos de Storage. Expo reescribe esos enlaces a través de Metro para que el teléfono descargue medios desde la IPv4 LAN. Metro también proxifica el upgrade WebSocket de Realtime.

## Diferencias móviles adaptadas

- Mensajes usan `/api/mensajes/conversaciones`, los nombres web del payload y el endpoint PATCH de lectura.
- Membresías y guardados usan los POST alternantes web. Se oculta la acción de borrar comentarios de foro porque la API web no ofrece esa ruta.
- La comunidad de perfil usa `/api/comunidad-perfil`; el modelo móvil transforma autor, respuestas y adjuntos web.
- Eventos se crean con JSON y lista de géneros. Los borrados de cuenta, eventos y previews envían la contraseña que exige la API web.
- Previews envían géneros como lista. La API web no guarda offsets de recorte; en móvil se publica el audio completo y se muestra esa condición. Para publicar un fragmento, recortarlo antes de elegir el archivo.
- La reproducción móvil registra sesiones de escucha en `/api/reels/:id/interaccion`, al igual que el cliente web.

## Documentación de referencia

- [Desarrollo local con Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started)
- [Guía de desarrollo local de Supabase](https://supabase.com/docs/guides/local-development)
- [Redes entre servicios de Compose](https://docs.docker.com/compose/how-tos/networking/)
- [Comparación técnica previa de ramas, base y contratos](DOCKER_PREFLIGHT_2026-10-30.md)
