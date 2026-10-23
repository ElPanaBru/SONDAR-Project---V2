# MVP de recomendaciones de Descubrir

La web solicita `GET /api/reels/descubrir`, que trae como máximo 100 reels elegibles y conserva el contrato de las tarjetas de Descubrir. Si la ruta nueva no responde correctamente, la web vuelve a `GET /api/reels`.

El ranking reutiliza `scorePreview` y `diversifyPreviews` de `Backend/services/discoverRecommender/`. El perfil combina los géneros seleccionados en `user_interests`, géneros de reels con like o guardados, y creadores seguidos. Los géneros se normalizan con el catálogo canónico compartido; se consideran todos los géneros de `reel_generos`, con fallback al género principal.

El inicio en frío puntúa recencia y menor cantidad de visitas como exploración, y aplica la misma diversificación por género y creador. No lee `user_genre_affinity`, sesiones agregadas de escucha ni impresiones.

Validación ejecutada: 64 pruebas backend relacionadas con recomendaciones, reels, Descubrir y contratos existentes; 3 pruebas frontend; `npm.cmd run build`; y `node --check` para los módulos backend modificados. Los fixtures ejercitan el ranking, ya que la base local no contiene reels. El build emite el aviso habitual de chunk principal mayor a 500 kB.
