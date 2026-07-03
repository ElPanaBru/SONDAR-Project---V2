# React + Vite

## App móvil

La app móvil necesita que Expo y la API estén activos al mismo tiempo. Desde la raíz del proyecto ejecutá:

```bash
npm run dev:mobile
```

Para el primer inicio en Expo Go o después de cambiar el SDK:

```bash
npm run dev:mobile:clear
```

No uses solamente `npx expo start` para probar registro, eventos o publicaciones: ese comando levanta Expo, pero no el backend del puerto `3000`.

Si Expo Go conserva una versión anterior, detené Expo y reinicialo desde `sondar-mobile` con:

```bash
npx expo start --clear --lan
```

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
