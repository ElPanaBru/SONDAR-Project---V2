# Temas del mapa

El modo oscuro usa Stadia Alidade Smooth Dark. El modo claro usa Jawg Lagoon cuando se configura su token; sin el conserva OpenFreeMap Liberty.

## Activar Jawg Lagoon

1. Obtener un token propio desde https://www.jawg.io/lab/.
2. Agregar en Frontend/.env.local (ignorado por Git):

```dotenv
VITE_JAWG_ACCESS_TOKEN=tu_token
```

3. Reiniciar Vite y seleccionar Mapa claro. Para publicar, configurar la misma variable en el entorno de compilacion y volver a compilar.

Vite incluye esta variable en el frontend: el token sera visible en las solicitudes del navegador. Usar un token destinado al mapa publico y configurar sus restricciones desde Jawg.

La configuracion anterior VITE_THUNDERFOREST_API_KEY ya no se utiliza.

Documentacion: https://www.jawg.io/docs/apidocs/maps/dynamic-maps/.
