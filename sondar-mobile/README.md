# SONDAR Mobile

App movil de SONDAR para Android, iOS y Expo Go. Comparte autenticacion, Supabase, storage y API con la version web.

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

El comando de desarrollo copia automaticamente las variables publicas de Supabase desde `Frontend/.env` hacia `sondar-mobile/.env.local`.

En desarrollo no hace falta configurar `EXPO_PUBLIC_API_URL`: tanto en LAN como en tunnel, la app usa el mismo servidor de Expo que entregó el bundle y Metro reenvía `/api` al backend local. El teléfono no necesita conectarse directamente al puerto `3000` de la PC.

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
