# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Actualizar la base local en otra computadora

Descargar cambios de GitHub no actualiza la base de cada equipo. Con Docker/Supabase local iniciado y Backend/.env apuntando a esa base, ejecutar desde la raiz:

```powershell
npm run db:actualizar --prefix Backend
```

El comando guarda un respaldo en la carpeta temporal, actualiza los ocho generos y las restricciones del registro, y permite responder en comunidades de perfil sin seguir al autor (respetando bloqueos). Verifica que se conserve el contenido. Todo se confirma en una sola transaccion; ante errores se revierte. Si Reggae tiene referencias, pide reclasificarlas en lugar de borrar contenido. Para ensayar sin guardar cambios: `npm run db:actualizar --prefix Backend -- --dry-run`.

Despues reiniciar el backend y recargar la pagina. Los cambios deben estar publicados en GitHub para que otro equipo pueda descargarlos.
