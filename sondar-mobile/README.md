# SONDAR Mobile

App movil de SONDAR para Android, iOS y Expo Go. Esta rama usa Supabase, autenticacion, Storage y PostgreSQL locales, en un proyecto Docker propio llamado `sondar-mobile-local`.

## Expo Go y SDK 58

El proyecto utiliza Expo SDK 58, React 19.3 y React Native 0.88. Es compatible con Expo Go para SDK 58; un iPhone fisico no permite instalar versiones antiguas de Expo Go.

Usar Node 24 LTS (24.3 o posterior), Node 22.13 o posterior dentro de la rama 22, o Node 26+. Node 25 no esta admitido por este SDK. La version recomendada figura en `.nvmrc`; con un gestor compatible puede seleccionarse Node 24 antes de instalar y arrancar.

Despues de actualizar dependencias, cerrar el servidor Expo anterior y ejecutar desde la raiz:

```bash
npm ci
npm ci --prefix sondar-mobile
npm run dev:mobile:clear
```

Escanear el QR nuevo. Si aparece un aviso que todavia menciona SDK 57, se esta abriendo un servidor anterior: comprobar que el servidor corresponda a esta carpeta y reiniciarlo con cache limpia.

Referencias: [actualizacion oficial](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/), [notas SDK 58](https://expo.dev/changelog/sdk-58) y [migracion de Router](https://docs.expo.dev/router/migrate/sdk-57-to-58/).

## Configuracion

Con Docker Desktop iniciado, `npm run dev:mobile:clear` levanta Supabase local, aplica las migraciones pendientes sin borrar datos y genera `Backend/.env.local` y `sondar-mobile/.env.local` con las claves de la CLI. Ya no toma credenciales de `Frontend/.env`. Los archivos generados no se versionan y el backend prioriza su `.env.local` sobre el `.env` heredado.

La instalacion nueva empieza con el catalogo de siete generos; las cuentas, publicaciones y archivos de la nube o de la rama web no se copian. Registrarse nuevamente en esta instalacion local.

Para iniciar solamente la base: `npm run local:start`. Para consultar los servicios: `npm run local:status`. Para detenerlos conservando datos: `npm run local:stop`. Los puertos y el flujo de migraciones estan en [la guia local](../docs/MOBILE_LOCAL.md).

En desarrollo no hace falta configurar `EXPO_PUBLIC_API_URL`: tanto en LAN como en tunnel, la app usa el mismo servidor de Expo que entregó el bundle. Metro reenvía `/api` al backend y `/supabase` a Supabase local, incluyendo Auth e imagenes/audio de Storage. El telefono solo necesita alcanzar Expo; no se configura `localhost` del telefono como direccion de la PC.

## Ejecutar En Expo Go

Desde la raiz del repo:

```bash
npm run dev:mobile:clear
```

Espera a que Expo muestre el QR oficial en la terminal y escanealo desde Expo Go.

Este comando usa LAN con la API protegida detrás del proxy de Expo. El celular y la PC deben estar en la misma red.

## LAN

Si queres probar en una red local que permita conexiones entre el celular y la PC:

```bash
npm run dev:mobile:lan:clear
```

Si la red bloquea incluso el acceso LAN a Expo, podés intentar:

```bash
npm run dev:mobile:tunnel:clear
```

## Verificacion

```bash
npm run typecheck --prefix sondar-mobile
```
