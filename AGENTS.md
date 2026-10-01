# AGENTS.md — SONDAR

## Proyecto

SONDAR es una aplicación web para descubrir eventos, música y comunidades.

- Repositorio: `https://github.com/ElPanaBru/SONDAR-Project---V2`
- Rama habitual: `Ultime_Ver_Funcional`
- Producción: `https://sond-ar.com`

## Stack y arquitectura

- Frontend: React + Vite
- Backend: Node.js + Express
- DB/Auth/Storage: Supabase
- Hosting: Render
- Email: Resend
- Mapas: Mapbox

```text
https://sond-ar.com
        ↓
Render — sondar-frontend
        ↓
Render — sondar-backend
        ↓
Supabase — DB/Auth/Storage
        ↓
Resend — email
```

Servicios:
- Frontend Render: `sondar-frontend`
- Backend Render: `sondar-backend`
- Backend URL: `https://sondar-backend.onrender.com`

`https://sond-ar.com` es el dominio principal. `www.sond-ar.com` redirige al dominio raíz.

## Variables de entorno

### Frontend

```text
VITE_API_URL=https://sondar-backend.onrender.com
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

### Backend

```text
FRONTEND_URL=https://sond-ar.com
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
DB_HOST=...
DB_NAME=...
DB_USER=...
DB_PASSWORD=...
RESEND_API_KEY=...
SUPPORT_EMAIL=...
```

Los valores reales deben permanecer únicamente en las variables de entorno correspondientes.

### Seguridad

NO:
- guardar secretos en Git;
- subir `.env`;
- imprimir claves, tokens, contraseñas o API keys en logs;
- restaurar credenciales que hayan sido expuestas;
- usar `SUPABASE_SERVICE_ROLE_KEY` en el frontend;
- pedir al usuario que pegue secretos en el chat.

## Estructura importante

```text
SONDAR-Project---V2/
├── Frontend/
│   └── src/
│       ├── lib/
│       ├── paginas/
│       └── ...
├── Backend/
│   ├── Controllers/
│   ├── middlewares/
│   ├── routes/
│   ├── services/
│   └── index.js
└── AGENTS.md
```

Archivos relevantes:

```text
Frontend/src/lib/supabaseClient.js
Frontend/src/paginas/Auth.jsx
Frontend/src/paginas/Soporte.jsx
Frontend/src/lib/reportarContenido.js

Backend/index.js
Backend/routes/soporte.js
Backend/Controllers/soporteController.js
```

## Backend

El servidor usa Express, CORS, Supabase y Resend.

Puerto:

```js
const PORT = process.env.PORT || 3000;
```

Health check:

```text
GET /api/health
```

El endpoint actualmente confirma que el backend está vivo y que `FRONTEND_URL` se está leyendo correctamente.

No exponer valores sensibles en nuevos endpoints de diagnóstico.

Rutas montadas en `Backend/index.js`:

```text
/api/usuarios
/api/eventos
/api/reels
/api/comunidades
/api/comunidad-perfil
/api/notificaciones
/api/soporte
/api/mensajes
```

Soporte:

```text
POST /api/soporte/mensaje
```

No confundir esta ruta con rutas antiguas de EmailJS.

## Autenticación

Supabase Auth gestiona las sesiones.

Configuración actual del cliente:

```js
createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: "implicit"
  }
});
```

Las peticiones autenticadas al backend envían:

```http
Authorization: Bearer <access_token>
```

El backend utiliza `authMiddleware` en las rutas protegidas.

No implementar autenticación paralela ni almacenar contraseñas en el frontend.

## Registro y verificación de email

El registro usa Supabase Auth:

```js
supabase.auth.signUp({
  email: cleanEmail,
  password: cleanPassword,
  options: {
    data: { username: cleanUsername },
    emailRedirectTo: `${window.location.origin}/auth`
  }
})
```

La confirmación de email está habilitada.

Supabase utiliza Resend como SMTP.

Remitente:

```text
no-reply@sond-ar.com
```

Dominio:

```text
sond-ar.com
```

El envío de confirmación de registro ya funciona.

## Soporte y denuncias

Anteriormente se utilizaba EmailJS/Gmail. Esa integración está siendo eliminada.

NO volver a implementar:
- `emailjs-com`;
- EmailJS;
- integración Gmail para soporte;
- reconexión de Gmail para soporte.

Arquitectura correcta:

```text
Frontend
   ↓
POST /api/soporte/mensaje
   ↓
authMiddleware
   ↓
soporteController
   ↓
Resend
   ↓
correo del equipo de soporte
```

El backend crea Resend con:

```js
const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_API_KEY);
```

El mensaje se envía desde:

```text
SONDAR <no-reply@sond-ar.com>
```

hacia:

```text
process.env.SUPPORT_EMAIL
```

Para respuestas:

```js
replyTo: email
```

El email del usuario debe obtenerse de la sesión autenticada (`req.user`), no confiar en un email arbitrario enviado por el frontend.

## Problema actual: comunicación Frontend → Backend

Este es el problema pendiente y debe investigarse antes de hacer refactorizaciones grandes.

El backend responde correctamente:

```text
https://sondar-backend.onrender.com/api/health
```

Pero desde producción se observan errores de red en varias funciones del frontend:

```text
NetworkError when attempting to fetch resource
```

y:

```text
La solicitud fue cancelada.
Caused by: DOMException: The operation was aborted.
```

Se observaron fallos en:
- soporte;
- contador de notificaciones;
- usuarios seguidos.

Por eso no asumir que el problema es exclusivo del formulario de soporte.

### Hipótesis actuales

Investigar, en este orden:

1. URL efectiva usada por el frontend.
2. CORS.
3. Conectividad navegador → `sondar-backend.onrender.com`.
4. Preflight `OPTIONS`.
5. Autenticación/middleware, si la petición llega.
6. Diferencia entre `sond-ar.com` y `www.sond-ar.com`.

No asumir la causa sin evidencia.

### Diagnóstico inmediato conocido

Para soporte se estaba agregando temporalmente:

```js
console.log("SONDAR SOPORTE - API_URL:", API_URL);
console.log(
  "SONDAR SOPORTE - URL:",
  `${API_URL}/api/soporte/mensaje`
);
console.log(
  "SONDAR SOPORTE - TOKEN:",
  session?.access_token ? "EXISTE" : "NO EXISTE"
);
```

Esperado:

```text
SONDAR SOPORTE - API_URL: https://sondar-backend.onrender.com
SONDAR SOPORTE - URL: https://sondar-backend.onrender.com/api/soporte/mensaje
SONDAR SOPORTE - TOKEN: EXISTE
```

Luego revisar Network y Console para comprobar si existe:
- POST;
- OPTIONS;
- error CORS;
- error TLS/DNS/conexión;
- HTTP 401/403/502;
- cancelación de la petición.

No cambiar CORS a ciegas antes de comprobar la petición real.

## CORS

El backend permite explícitamente:

```text
https://sond-ar.com
```

y orígenes locales de desarrollo:

```text
http://localhost:5173
http://127.0.0.1:5173
http://localhost:3001
http://127.0.0.1:3001
```

Headers relevantes:

```text
Content-Type
Authorization
```

Métodos:

```text
GET
POST
PUT
PATCH
DELETE
```

Si se modifica CORS, mantener una lista explícita de orígenes necesarios.

No usar `origin: "*"` como solución rápida con credenciales.

## Frontend Render

Build:

```text
npm run build
```

Render necesita el rewrite SPA:

```text
/* -> /index.html
```

para las rutas de React Router.

## Git

Rama:

```text
Ultime_Ver_Funcional
```

Antes de cambios importantes:

```bash
git status
git diff
```

Después de cambios verificados:

```bash
git add .
git commit -m "descripcion"
git push origin Ultime_Ver_Funcional
```

No hacer commits automáticos de `.env` ni secretos.

Antes de eliminar dependencias o archivos, comprobar sus referencias.

## Reglas para Codex

1. Diagnosticar antes de refactorizar.
2. Hacer cambios pequeños y verificables.
3. No romper funcionalidades existentes.
4. Mantener compatibilidad con producción.
5. No tocar credenciales.
6. No cambiar infraestructura sin evidencia.
7. No eliminar rutas sin comprobar sus consumidores.
8. No declarar resuelto un problema de red solo porque el build funciona.

Cuando sea posible, después de modificar:

```bash
npm run build
```

y ejecutar tests/lint si el proyecto dispone de ellos.

Para problemas de backend, comprobar que el servidor arranca.

## Decisiones ya tomadas

- Render para frontend/backend.
- Supabase para DB/Auth/Storage.
- Resend para email.
- Dominio de producción: `sond-ar.com`.
- Confirmación de registro mediante Supabase + Resend.
- Credenciales previamente expuestas fueron rotadas/revocadas.
- Secretos trasladados a variables de entorno de Render.
- Soporte y denuncias migrados de EmailJS/Gmail a Resend.
- Backend operativo en `/api/health`.
- Problema pendiente: determinadas peticiones del frontend no están comunicándose correctamente con el backend.

## Flujo de trabajo recomendado

```text
1. Reproducir
2. Identificar archivo/petición exacta
3. Revisar evidencia
4. Formular hipótesis
5. Hacer el cambio mínimo
6. Probar localmente
7. Ejecutar build
8. Commit
9. Push
10. Verificar producción
```

Trabajar incrementalmente y conservar las funcionalidades existentes.
