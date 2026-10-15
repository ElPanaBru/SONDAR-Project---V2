# Referencia aprobada de SONDAR - 15 octubre 2026

Rama: Web_BDD_Local
Commit base: 8c9c3eaf9051dd174d2c4b3255130e097225db3f
Los cambios guardados estaban SIN COMMIT. Se conserva un parche y copias completas de los archivos modificados/nuevos.

## Objetivo siguiente
Comparar con la rama que integra Supabase remoto y trasladar el resultado visual conservando su autenticacion, conexion, storage y logica. No reemplazar configuraciones ni aplicar a ciegas los controladores de la rama local.

## Resultado visual aprobado
- Comunidad: solo nombre del genero, sin prefijos s/ ni r/.
- Se elimino la separacion extra de hasta 160 px entre lista y contenido; contenido ocupa el ancho.
- Circulo del genero completo, identidad posicionada por encima de la portada.
- Sin fotos de portada por genero.
- Cabecera con barras de sonido y patrones distintos por genero, paleta negra, naranja y dorada SONDAR.
- Ilustraciones SVG propias de instrumentos; NO emojis del sistema.
- Ultima correccion aprobada: tres simbolos pequenos INTERCALADOS entre las barras (indices 12, 27, 41), con la misma transparencia. No ilustraciones grandes delante ni orbitas superpuestas.
- Eventos: panel inferior compacto, ancho maximo 640 px, menos padding inferior y separacion, resumen de 68 px.
- Fila de generos centrada con safe center y textos centrados dentro de botones; scroll disponible en pantallas chicas.

## Catalogo definitivo: OCHO generos
Pop, Rock, Metal, Urbano, Jazz, Blues, Funk, Folklore, en ese orden.
Reggae fue retirado posteriormente a pedido del usuario.
Catalogo comun en shared/generos.json; usado en onboarding/registro, comunidades, eventos, reels, filtros y validaciones.
Equivalencias aprobadas como organizacion del producto: Trap/Rap/Hip hop/Reggaeton/Cumbia/Latina -> Urbano; Punk/Alternativo -> Rock; EDM/Electronica -> Pop; Soul/Disco -> Funk; Otros -> Pop.
No queda equivalencia Ska -> Reggae en el catalogo final.

## Base de datos
Se modifico SOLO la base local 127.0.0.1:54322. Supabase remoto NO fue modificado.
Migraciones: Unificar_Generos_Definitivos.sql y luego Retirar_Reggae.sql; copias versionadas en supabase/migrations.
Se actualizaron generos, comunidades, eventos, reels, relaciones de generos, intereses, preferencias y afinidades; membresias fusionadas y categorias antiguas borradas tras migrar referencias.
La primera migracion contempla nueve generos; la segunda retira Reggae y deja ocho. Revisar referencias reales de la base remota ANTES de ejecutar: Retirar_Reggae aborta si tiene referencias. Nunca borrar contenido por cascada.
Base local verificada: 1 evento, 0 reels, 0 publicaciones conservados. Reggae no tenia referencias.
Respaldo local previo: C:/Users/tebyb/AppData/Local/Temp/sondar-antes-generos-20261015-151309.dump
Docker y Supabase local quedaron iniciados.
No instalar migraciones automaticas al arrancar el backend. La revision automatica rechazo esa estrategia; luego el usuario autorizo una ejecucion unica sobre la base local.

## Verificacion
Build frontend y lint del componente de portada correctos. Tests de catalogo y eventos pasaron.
La suite general tiene fallos previos, incluido listar reels con esquema antiguo; ese fallo se reprodujo usando el controlador original de HEAD. No afirmar que toda la suite pasa.

## Archivos de referencia
archivos/ contiene copias del estado final de los archivos cambiados y nuevos.
cambios.patch contiene el diff de archivos rastreados respecto del commit base; los nuevos estan en archivos/.
No se copiaron .env, credenciales ni datos de usuarios.
