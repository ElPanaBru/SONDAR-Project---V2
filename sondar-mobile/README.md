# SONDAR Mobile

App movil de SONDAR para Android, iOS y Expo Go. Comparte autenticacion, Supabase, storage y API con la version web.

## Configuracion

El comando de desarrollo copia automaticamente las variables publicas de Supabase desde `Frontend/.env` hacia `sondar-mobile/.env.local`.

En desarrollo no hace falta configurar `EXPO_PUBLIC_API_URL`: en LAN la app toma la IP de Expo y usa el backend en el puerto `3000`; en tunnel usa el servidor de Expo como proxy y Metro reenvia `/api` al backend local.

## Ejecutar En Expo Go

Desde la raiz del repo:

```bash
npm run dev:mobile:clear
```

Espera a que Expo muestre el QR oficial en la terminal y escanealo desde Expo Go.

Este comando usa tunnel para que Expo Go no dependa de que el celular pueda entrar a la IP LAN de la PC.

## LAN

Si queres probar en una red local que permita conexiones entre el celular y la PC:

```bash
npm run dev:mobile:lan:clear
```

## Verificacion

```bash
npm run typecheck --prefix sondar-mobile
```
