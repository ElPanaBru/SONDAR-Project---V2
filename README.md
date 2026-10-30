# SONDAR

Aplicación de música y comunidades. Esta rama es `Mobile-Local`: incluye el cliente web de `Web_BDD_Local`, la API web, el cliente Expo y las migraciones web como fuente única de verdad.

## Desarrollo local web y móvil

Desde la raíz de esta rama, `npm run dev` y `npm run son` usan el mismo proyecto Docker. Ambos levantan Vite, una API web, Metro/Expo y la misma instancia Supabase local con `project_id = SONDAR-Project---V2`.

```powershell
npm ci
npm run dev
```

Abrí la web en http://localhost:3001. Para escanear el QR de Expo Go desde un teléfono en la misma red:

```powershell
npm run son
npm run docker:logs
```

Guía de puertos, variables, migraciones y detención: [docs/DOCKER_LOCAL_UNIFICADO.md](docs/DOCKER_LOCAL_UNIFICADO.md). Referencia móvil: [docs/MOBILE_LOCAL.md](docs/MOBILE_LOCAL.md).

## Detener sin borrar la base

```powershell
npm run docker:down
```

El historial canónico está en `supabase/migrations`. No usar `supabase db reset --local` si necesitás conservar los datos locales.