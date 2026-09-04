# SONDAR Mobile

App movil de SONDAR para Android, iOS y Expo Go. Comparte autenticacion, Supabase, storage y API con la version web.

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
