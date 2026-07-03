# SONDAR Mobile

Aplicación móvil de SONDAR para Android, iOS y Expo Go. Comparte autenticación, base de datos, almacenamiento y API con la versión web.

## Configuración

1. Copiá `.env.example` como `.env`.
2. Usá en `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY` los mismos valores públicos del frontend.
3. En un teléfono físico, `EXPO_PUBLIC_API_URL` debe apuntar a la IP LAN de la computadora (por ejemplo `http://192.168.1.100:3000`). Si se omite durante desarrollo, la app intenta obtener esa IP desde Expo.

## Ejecutar

Desde la raíz del repositorio:

```bash
npm run dev:mobile
```

O solamente la app:

```bash
npm start --prefix sondar-mobile
```

## Verificación

```bash
npm run typecheck --prefix sondar-mobile
npm run lint --prefix sondar-mobile
```
