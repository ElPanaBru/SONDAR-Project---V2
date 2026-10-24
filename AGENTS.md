# AGENTS.md — SONDAR

## 1. Contexto y objetivo del proyecto

SONDAR es una plataforma social musical, disponible en web y móvil, orientada a la difusión de artistas under y a la formación de comunidades musicales.

Sus principales funcionalidades son:

- **Descubrir:** feed de previews musicales con reproducción, likes, comentarios, guardados y compartidos.
- **Eventos:** descubrimiento de recitales y eventos mediante información musical y geográfica.
- **Foros:** comunidades de discusión organizadas por intereses y géneros musicales.
- **Comunidad:** publicaciones de artistas y sus interacciones con usuarios.

El objetivo es mantener una aplicación estable, mantenible, eficiente y preparada para crecer, priorizando soluciones sencillas que puedan verificarse mediante pruebas.

## 2. Reglas generales de trabajo

Antes de realizar modificaciones:

1. Lee las instrucciones pertinentes y examina el código real del repositorio.
2. Comprueba el estado de Git y preserva los cambios existentes que no pertenezcan a la tarea.
3. Identifica las dependencias entre el código, la base de datos, las migraciones y los clientes web y móvil.
4. Consulta los scripts disponibles en los archivos `package.json` antes de ejecutar comandos.
5. Comprueba si existen documentación, pruebas o implementaciones reutilizables antes de crear alternativas.

No asumas que la documentación o los comentarios representan necesariamente el estado actual del código. Contrasta las afirmaciones importantes con la implementación.

No reescribas funcionalidades completas sin una justificación técnica. Prefiere cambios incrementales, acotados y verificables.

No declares una tarea terminada si las pruebas relevantes no se ejecutaron o si existen errores pendientes que afectan a sus criterios de aceptación.

## 3. Arquitectura y tecnologías

El proyecto utiliza o ha utilizado los siguientes componentes:

- Backend con Node.js.
- Frontend web con React y Vite.
- Aplicación móvil basada en Expo.
- Supabase y PostgreSQL.
- Almacenamiento de archivos multimedia.
- Código y recursos compartidos entre partes del proyecto.

Verifica la estructura actual antes de asumir que todos estos componentes siguen presentes o utilizan la misma configuración.

Respeta las convenciones y dependencias existentes. No migres de framework, cambies el motor de base de datos ni incorpores servicios externos, nuevas dependencias o infraestructura adicional sin una necesidad técnica demostrable y documentada.

Mantén separadas las responsabilidades entre interfaz, API, lógica de negocio, persistencia y almacenamiento multimedia.

Cuando una funcionalidad se utiliza desde web y móvil, identifica qué lógica puede compartirse y qué comportamiento es específico de cada plataforma.

## 4. Base de datos y migraciones

La base de datos es una parte crítica de SONDAR.

- Revisa primero el esquema existente, sus relaciones, restricciones, índices, funciones, triggers y políticas RLS.
- Utiliza `supabase/migrations` como ubicación principal de las migraciones, de acuerdo con la organización actual del proyecto.
- No modifiques migraciones históricas que ya puedan haberse aplicado o compartido. Crea nuevas migraciones para los cambios de esquema.
- No dupliques tablas o información sin comprobar primero si existe una estructura que pueda reutilizarse.
- No elimines tablas, columnas, relaciones, triggers o datos sin comprobar sus dependencias y justificar la necesidad.
- Considera la integridad referencial, las operaciones concurrentes y la idempotencia cuando corresponda.
- Comprueba el impacto de los cambios sobre los datos existentes, las consultas del backend y las políticas de seguridad.
- Prueba las migraciones en el entorno local antes de recomendar su aplicación en otros entornos.

No ejecutes migraciones remotas, modificaciones destructivas ni operaciones sobre producción sin autorización explícita.

Cuando se necesite una modificación de esquema, explica su finalidad, los objetos afectados, los riesgos y la forma de validarla y revertirla.

No consideres que la existencia de una migración garantiza que la base de datos real tenga ese esquema. Distingue entre el esquema esperado por el repositorio y el efectivamente desplegado.

## 5. Seguridad y configuración

- No muestres, copies, registres ni incluyas en documentación secretos, contraseñas, tokens, claves privadas o cadenas de conexión sensibles.
- Nunca incorpores credenciales en el código fuente.
- No abras ni reproduzcas archivos `.env` para incluir sus valores en respuestas o informes.
- No incluyas archivos `.env`, respaldos privados de bases de datos ni credenciales en los cambios propuestos.
- Utiliza las variables de entorno y los mecanismos de configuración adecuados para cada entorno.
- Mantén las claves privilegiadas exclusivamente en el servidor.
- Respeta la autenticación, la autorización y las políticas RLS existentes; verifica sus efectos antes de modificarlas.
- No confíes en valores enviados por el cliente para establecer la identidad del usuario, sus permisos o sus afinidades musicales.
- Valida las entradas y evita que un usuario pueda registrar acciones o modificar información perteneciente a otro usuario.

No conectes el trabajo de desarrollo con la base de producción salvo que exista una necesidad concreta y se haya autorizado expresamente.

## 6. Rendimiento y calidad del código

Busca optimizaciones que reduzcan trabajo real, sin sacrificar la claridad o la corrección.

Presta especial atención a:

- Consultas repetidas o innecesarias a la base de datos.
- Patrones N+1 en los que cada elemento desencadena nuevas solicitudes.
- Consultas que procesan muchos más registros de los que necesita la respuesta.
- Transferencia innecesaria de columnas, relaciones o archivos multimedia.
- Solicitudes HTTP redundantes.
- Escrituras excesivas provocadas por eventos frecuentes.
- Índices que no se utilizan o que encarecen innecesariamente las escrituras.
- Cálculos repetidos que puedan resolverse mediante agregaciones, caché justificada o datos precalculados.

No agregues índices, cachés ni tablas de resumen indiscriminadamente. Evalúa los patrones de consulta y utiliza planes de ejecución y mediciones cuando sea posible.

Evita las optimizaciones prematuras y las refactorizaciones sin relación con el objetivo de la tarea.

Conserva las convenciones del proyecto y prioriza funciones con responsabilidades claras, código reutilizable cuando aporte valor y errores que puedan diagnosticarse fácilmente.

## 7. Directrices específicas para Descubrir

El recomendador musical debe desarrollarse como un subsistema modular y verificable.

Los algoritmos heredados de intentos anteriores son antecedentes técnicos, no la especificación del nuevo sistema. No reutilices automáticamente sus pesos, fórmulas o reglas. Examina sus dependencias y conserva únicamente las estructuras o componentes cuya utilidad pueda justificarse.

El diseño objetivo separa estas responsabilidades:

1. Registro de interacciones e impresiones.
2. Cálculo y mantenimiento de afinidades por género y artista.
3. Selección de candidatos elegibles.
4. Puntuación de relevancia de cada preview.
5. Diversificación y control de repeticiones.
6. Entrega de tandas paginadas con orden estable.

Principios obligatorios:

- La personalización debe combinar relevancia y diversidad musical.
- No reduzcas el perfil del usuario a un único género favorito.
- Considera todos los géneros válidos asociados a una preview, respetando sus relaciones y pesos cuando existan.
- Distingue entre una preview mostrada, una reproducción iniciada y una escucha significativa.
- Las señales deben tener pesos acordes a su significado y evitar que repeticiones artificiales dominen el perfil.
- Los datos históricos antiguos no deben tratarse como preferencias actuales sin considerar su fecha y fiabilidad.
- Los usuarios nuevos deben recibir recomendaciones útiles aun sin historial de actividad.
- Los artistas poco expuestos deben poder aparecer sin que la popularidad sea el único factor de selección.
- Las reglas de diversidad no deben impedir el funcionamiento del feed cuando el catálogo disponible sea reducido.
-