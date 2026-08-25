# Beta de mensajeria, ubicacion y recomendaciones

## Estado

La migracion `Backend/BDD-Sql/Sistema_Beta_Mensajeria_Ubicacion_Recomendaciones.sql`
ya fue aplicada a la base configurada actualmente en `Backend/.env`. Es aditiva:
no elimina las tablas ni los datos existentes.

Para instalar el mismo sistema en otra base:

```powershell
cd Backend
node scripts/aplicarMigracionSql.js Sistema_Beta_Mensajeria_Ubicacion_Recomendaciones.sql
```

PostGIS debe estar instalado en el esquema `gis` antes de ejecutar el comando.

## Probar la beta

1. Iniciar frontend y backend con `npm run dev` desde la raiz.
2. Abrir `http://localhost:3001`.
3. Iniciar sesion con dos usuarios distintos en dos navegadores o perfiles privados.
4. Abrir `/mensajes` o pulsar `Mensaje` desde el perfil del otro usuario.
5. En Eventos, permitir la ubicacion y elegir un radio de distancia.
6. En Descubrir, escuchar, terminar, repetir y saltar previews. Las nuevas solicitudes
   del feed utilizaran esas señales para recalcular la afinidad por genero.

La prueba automatizada integral se ejecuta con:

```powershell
cd Backend
node scripts/probarTodo.js
```

La prueba crea dos cuentas temporales, valida los sistemas y elimina los datos creados.

## Mensajeria incluida

- Conversaciones directas unicas entre dos usuarios.
- Busqueda de usuarios y acceso desde perfiles.
- Historial persistente y paginacion por cursor.
- Envio, respuesta, edicion durante 15 minutos y eliminacion para todos.
- Contadores de mensajes no leidos y estado `Enviado`/`Visto`.
- Broadcast de altas, cambios y eliminaciones desde PostgreSQL.
- Indicador `escribiendo`, Presence y estado en linea.
- Canales privados autorizados mediante RLS.
- Actualizacion cada ocho segundos como respaldo si Realtime se desconecta.
- Bloqueos bidireccionales: un bloqueo existente impide iniciar o continuar el envio.
- Limite de ocho mensajes cada diez segundos y maximo de 2.000 caracteres.
- Texto tratado como contenido plano; React escapa su representacion en la interfaz.

## Ubicacion incluida

- Coordenadas obligatorias al crear eventos.
- Columna `geography(Point, 4326)` sincronizada con latitud y longitud.
- Indice espacial GiST.
- Distancia en metros o kilometros calculada por PostGIS.
- Filtros de 10, 25, 50 y 100 kilometros.
- El navegador solicita la ubicacion solamente mediante su API de permisos.
- La coordenada del usuario se envia en cada consulta, pero esta beta no la almacena
  como parte de su perfil.
- La cercania de eventos tambien influye en el orden de Descubrir.

## Recomendador incluido

El orden combina:

- Generos seleccionados durante el onboarding.
- Duracion real escuchada y porcentaje completado.
- Finalizaciones, repeticiones y saltos tempranos.
- Likes, comentarios, compartidos y visitas.
- Artistas seguidos.
- Cercania de eventos futuros del artista.
- Afinidad con actividad de usuarios de edad similar.
- Popularidad y antiguedad del reel.
- Penalizacion de contenido ya visto y contenido propio.
- Un 15 % determinista de exploracion diaria.
- Diversificacion para evitar mas de dos reels seguidos del mismo genero o creador
  cuando haya alternativas.

La afinidad aprendida pierde peso con el tiempo. Esto evita que una escucha antigua
defina permanentemente el feed.

## Correccion de previews de perfiles

Al abrir una preview desde un perfil, la URL lleva tanto el reel seleccionado como el
identificador de su creador. La API valida ese UUID y devuelve exclusivamente los reels
del perfil, ordenados del mas reciente al mas antiguo. El feed general sigue usando el
recomendador.

## Funciones que faltan despues de esta beta

### Prioridad alta antes de produccion publica

- Renovar credenciales expuestas, retirar `.env` de Git y revisar el historial.
- Desactivar canales publicos de Realtime despues de verificar los canales privados.
- HTTPS para frontend y API, dominios CORS definitivos y limites por IP/cuenta.
- Copias de seguridad verificadas y plan de restauracion, incluyendo Storage.
- Observabilidad: errores centralizados, metricas, latencia, alertas y auditoria.
- Pruebas de carga para mensajes, Broadcast y consultas de recomendacion.
- Herramientas de moderacion de conversaciones y sistema de apelaciones.

### Siguiente version de mensajeria

- Solicitudes de mensajes para usuarios que no se siguen.
- Fotos, audio, archivos y envio de reels/eventos dentro del chat.
- Reacciones, busqueda en conversaciones, silenciar, archivar y borrar solo para uno.
- Notificaciones push/web cuando la aplicacion esta cerrada.
- Conversaciones grupales y roles de administracion.
- Estado `entregado` separado de `enviado` y sincronizacion multi-dispositivo avanzada.
- Cifrado de extremo a extremo si pasa a ser un requisito del producto.

### Siguiente version de ubicacion y eventos

- Autocompletado y geocodificacion de direcciones.
- Ubicacion aproximada o ciudad guardada para usuarios que no conceden GPS.
- Tiempo de viaje y rutas, no solamente distancia en linea recta.
- Eventos recurrentes, aforo, entradas, recordatorios y confirmacion de asistencia.
- Agrupacion espacial del lado del servidor para catalogos con muchos eventos.
- Privacidad adicional para eventos privados o ubicaciones reveladas tras confirmar.

### Siguiente version del recomendador

- Acciones explicitas `No me interesa`, `Mostrar mas` y `Ocultar artista`.
- Paginacion de candidatos y precomputacion cuando el catalogo crezca.
- Evaluaciones offline, experimentos A/B y metricas de calidad/diversidad.
- Deteccion de reproducciones fraudulentas y manipulacion de popularidad.
- Recomendacion colaborativa y embeddings de audio cuando haya volumen suficiente.
- Controles del usuario para consultar y restablecer sus gustos aprendidos.
- Reglas editoriales para lanzamientos patrocinados o destacados.

### Plataforma general

- Fuente real de la aplicacion movil; actualmente `sondar-mobile` solo contiene entorno.
- Accesibilidad auditada, navegacion completa por teclado y pruebas con lectores de pantalla.
- PWA/offline, recuperacion de cargas interrumpidas y sincronizacion en segundo plano.
- Panel administrativo de usuarios, reportes, eventos, contenido y salud del sistema.
