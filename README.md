# OUTPOST · Beyond the Mission

Juego en HTML, CSS y JavaScript. **`index.html` es la entrada única.** Incluye inicio, nave, selección lunar, cinco tripulantes, las tres misiones, informes y el análisis científico de Primer contacto. Marte sigue sin estar disponible.

Para ejecutar la integración de datos, sirve esta carpeta por HTTP (por ejemplo con GitHub Pages o `python3 -m http.server 8080`) y abre `http://localhost:8080`. Abrir `index.html` mediante `file://` no permite consultar los JSON locales en la mayoría de navegadores; se muestra un error recuperable, no datos inventados. El juego no necesita una clave NASA ni un backend.

## Controles y pantalla

- Introducción: **E**, **Enter** o el botón. El movimiento se habilita al terminar la bienvenida.
- WASD, flechas o botones: acercarse a Neil, Curiosity o a un objetivo. **E** para interactuar.
- En la plataforma lunar solo hay movimiento horizontal. Las cinemáticas bloquean los controles.
- Mapa, estadísticas, diálogo y controles comparten el alto disponible de la ventana. El mapa conserva su relación 16:9 y se ajusta a la altura real de cada conversación; no se enfoca el texto desplazando la página.
- El panel técnico largo tiene su propio desplazamiento; la conversación principal no.
- La expedición se guarda al finalizar cada misión. «Continuar expedición guardada» conserva recursos y disponibilidad del rover. «Comenzar misión» inicia una expedición nueva.

## Primer contacto · datos auténticos y simulación

1. Se sortea una de cuatro rutas desde la misma base ficticia en Connecting Ridge.
2. «Análisis del terreno» consulta **NASA Moon Trek WMTS** y ensambla los mosaicos sobre coordenadas polares. Incluye zoom, base, destino, ruta y perfil de elevación.
3. Distancia, pendientes y desniveles proceden de los modelos **LOLA Site01**, procesados previamente. Son datos históricos locales, no nuevas mediciones en tiempo real.
4. Se estiman tiempo, recursos y riesgo según ruta y equipo. El jugador elige rover o astronauta.
5. La cinemática conserva el arte del juego y añade un marcador geográfico que sigue la distancia real de la ruta, con ida y vuelta aceleradas.
6. Un sorteo determina éxito, pérdida del rover o retirada humana. Una pérdida antes del destino no aporta observaciones nuevas. Se conserva el consumo ya efectuado.
7. El informe breve muestra el estado y los cambios reales aplicados a las reservas. «Ver más información» explica fuentes, fórmulas, unidades, riesgos y solicitudes.

La misión 2 mantiene sus escenarios y dos cinemáticas. **Si el rover se perdió, la expedición del cráter se aplaza:** no aparece otro vehículo ni se cobran consumos de una salida inexistente. El juego continúa con el objetivo incompleto.

## Integraciones verificadas

### NASA Moon Trek · servicio WMTS

- Documentación: <https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=moon>
- Capa: `Site01_final_adj_5mpp_Hillshade` (LRO LOLA, Connecting Ridge).
- Endpoint: <https://trek.nasa.gov/tiles/Moon/SP/Site01_final_adj_5mpp_Hillshade>
- GetCapabilities: <https://trek.nasa.gov/tiles/Moon/SP/Site01_final_adj_5mpp_Hillshade/1.0.0/WMTSCapabilities.xml>
- Plantilla de mosaicos verificada: `/1.0.0/default/default028mm/{z}/{row}/{col}.png`.
- PNG de 256 × 256; niveles 0–10 publicados; el juego usa 9 y 10 (aprox. 16,72 y 8,36 m/píxel de visualización). El DEM fuente es de 5 m/píxel.
- Ejemplo HTTP 200 verificado: <https://trek.nasa.gov/tiles/Moon/SP/Site01_final_adj_5mpp_Hillshade/1.0.0/default/default028mm/9/258/253.png>.
- El servidor devuelve `Access-Control-Allow-Origin: *` para capacidades y mosaicos. No se necesita proxy.
- La capa es **relieve sombreado real derivado de LOLA**, no una foto de LROC ni una medición de iluminación solar.

`moon-map.js` solicita metadatos y mosaicos oficiales por HTTP con tiempo límite y cuatro solicitudes simultáneas como máximo. Los mosaicos ya utilizados se reutilizan durante la misión. Se registran URL, hora, estado, capa, nivel, fila y columna. Solo una respuesta correcta y una imagen decodificada cuentan como carga por HTTP.

Si NASA falla, se usan los mosaicos descargados del **mismo servicio** en `data/nasa/tiles/`, identificados como «Caché local NASA». `wmts.json` conserva fecha, URL, tamaño y SHA-256 de cada uno. En contextos seguros se comprueba también el hash al leer el respaldo. Si tampoco está disponible la caché, aparece «no disponibles»; no se dibuja una imagen inventada. La copia comprende 25 mosaicos y menos de 1 MB. No hay descargas globales de la Luna durante la partida.

**Particularidad del WMTS:** las capacidades declaran `EPSG:0` y un `WGS84BoundingBox` que en realidad contiene metros. No se usa ese bloque como longitud/latitud. Se resuelve la proyección con los metadatos oficiales de la capa (`data/nasa/layer-metadata.json`): polar estereográfica sur, radio lunar 1 737 400 m, meridiano 0°, origen −90°, sin desplazamientos, IAU2000:30120. Coincide con la proyección y límites de los GeoTIFF Site01. El origen de mosaicos y la resolución salen de `GetCapabilities`: resolución = ScaleDenominator × 0,00028. Las rutas se dibujan directamente en metros de esa proyección, sin Web Mercator terrestre.

### NASA LOLA · modelos históricos

- Fuente: <https://pgda.gsfc.nasa.gov/products/78>
- Elevación: <https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site01/Site01_final_adj_5mpp_surf.tif>
- Pendientes: <https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site01/Site01_final_adj_5mpp_slp.tif>
- Referencia: Barker et al., *Improved LOLA Elevation Maps for South Pole Landing Sites*, DOI <https://doi.org/10.1016/j.pss.2020.105119>.
- Marco MOON_ME DE421; resolución 5 m/píxel; elevaciones en metros relativas al radio de 1 737 400 m; pendientes en grados.

`data/nasa/routes.json` conserva hashes de los TIFF, coordenadas, muestras originales de altura y pendiente, distancias acumuladas y métricas derivadas. No hace falta descargar los ~82 MB de TIFF para jugar.

| Ruta | Distancia de ida calculada | Pendiente máxima muestreada | Relieve máx. − mín. |
| --- | ---: | ---: | ---: |
| Llanura de reconocimiento | 501,42 m | 3,579° | 6,10 m |
| Sendero de la cresta | 1 200,83 m | 9,175° | 45,31 m |
| Ladera accidentada | 2 500,24 m | 14,393° | 86,49 m |
| Aproximación a la sombra | 4 000,73 m | 12,605° | 88,51 m |

Base ficticia común: X −9 010 m, Y −6 910 m; longitud −127,485524°, latitud −89,625549°. Dijkstra busca recorridos en una malla de 20 m y limita cada celda por la **máxima** pendiente de sus 16 píxeles de 5 m, sin cortar esquinas diagonales. Se muestrea el recorrido cada ≤5 m. Las rutas satisfacen cobertura y límites topográficos propuestos; esto no certifica seguridad física real. La altimetría incluye interpolación; no identifica todos los bloques ni obstáculos menores de 5 m. «Aproximación a la sombra» es un nombre de diseño: no se midió la iluminación con esta capa.

### Recursos y riesgo · simulación configurable

Los coeficientes están en `LunarScience.balance` en `science.js`:

- Tiempo: distancia de ida y vuelta / velocidad × (1 + pendiente media / 20) + tiempo de estudio.
- Oxígeno: tiempo × (5 astronautas × consumo habitual + consumo del traje cuando procede).
- Energía: soporte de base por hora + distancia × equipo × factor de pendiente + ascenso/descenso + instrumentos.
- Radiación: tiempo × (índice protegido + exposición exterior si sale un astronauta) × condición ambiental simulada.
- Riesgo del rover: referencia de ruta + 0,8 % por km de ida + 0,2 % por grado de pendiente máxima + 0,6 % por 100 m de relieve, con techo de 45 %. Riesgo humano de retirada: 60 % del riesgo del rover, con techo de 30 %.

El sorteo ocurre **una vez** por decisión, con `Math.random()`. Los fallos suceden antes de la transmisión del destino. Se descuenta la fracción transcurrida del consumo previsto; una retirada incluye el regreso. Se redondea hacia arriba y se limita a reservas de 0–100. El resumen muestra el descuento efectivamente aplicado.

Estos porcentajes son **puntos de un juego, no dosis ni predicciones de NASA**. El índice de Primer contacto se calcula con datos del terreno. Alerta solar incorpora DONKI y RadLab por separado.

## Misión 3 · Alerta solar

- [NASA DONKI SEP](https://ccmc.gsfc.nasa.gov/tools/DONKI/) busca registros de los últimos 30 días. Si faltan registros observados, consulta mayo de 2024 y usa una copia local fechada como respaldo. El 15 de noviembre de 2026, la consulta reciente devolvió una lista vacía y el archivo devolvió eventos observados.
- [NASA RadLab](https://visualization.osdr.nasa.gov/radlab/gui/data-api/) consulta ventanas históricas acotadas para LND y CRaTER. LND no devolvió registros en la ventana consultada. CRaTER-D1D2 devolvió 48 mediciones orbitales de LRO del 9 y 10 de mayo de 2020 en μGy/h. RadLab no entregó permiso CORS para el origen del juego en la prueba HTTP, por lo que el navegador puede usar las mediciones originales incluidas en la copia local.
- La dosis absorbida de fondo se simula en μGy con la tasa de referencia, el tiempo fuera, el tiempo bajo un blindaje supuesto del 25 % de transmisión y una variación de ±25 %. El registro solar modifica la probabilidad de la alerta simulada. La alerta y el indicador de radiación del juego no calculan la dosis adicional de un evento SEP.
- La alerta alta bloquea la opción de asegurar equipos. «Ver más información» muestra fuentes, fechas, consultas y supuestos.

El idioma se elige en la portada y se recuerda entre sesiones. El informe final vive en `results.html`. Recibe el estado de la expedición y muestra el resumen, los recursos y cada objetivo por turnos bajo la Tierra.

## Pruebas y reproducción

```sh
npm install
npm test
```

Las pruebas validan las cuatro rutas y todas sus muestras, coordenadas/píxeles WMTS, hashes PNG, consumo, éxito y fallo, carga de red/caché/error y **64 combinaciones de expedición lunar**, con persistencia de pérdida del rover y bloqueo del movimiento durante diálogos y cinemáticas. Las pruebas de DOM usan respuestas controladas; no sustituyen una prueba visual en navegador.

Comprobaciones directas realizadas el 15 de noviembre de 2026: metadatos oficiales HTTP 200, ambos GeoTIFF descargados, 25 mosaicos oficiales HTTP 200 y PNG decodificados. También se revisó una composición cartográfica de las cuatro rutas. **En esa revisión inicial, la comprobación visual del HTML lunar quedó pendiente:** los navegadores disponibles rechazaron la conexión al servidor local. No se afirma que se haya comprobado visualmente cada resolución de pantalla.

Para regenerar los datos (Python con `numpy scipy rasterio pyproj requests Pillow`):

```sh
# Descarga los dos TIFF de las fuentes anteriores como surf.tif y slp.tif.
python scripts/prepare-lola.py /ruta/a/los/tiff
python scripts/cache-moon-trek.py
```

Los TIFF originales no se incluyen en Git. El catálogo original de la capa y las capacidades verificadas sí se conservan para trazabilidad. No hay claves ni servicios privados.

## Campaña de Marte

Curiosity abre tres misiones independientes de las lunares: reconocimiento de Jezero, tormenta de polvo y producción experimental de oxígeno. Se conservan los controles, recursos, guardado, diálogos de novela visual y la campaña de Neil en la Luna. Marte termina en `mars-finale.html`, una adaptación de la escena del Space Center suministrada por el autor, con Vanessa, su retrato y un diálogo que responde a las decisiones de la partida.

Las fuentes, extractos y límites del modelo están documentados en [data/mars/README.md](data/mars/README.md) y en «Ver más información» durante cada misión. Los registros son históricos; los costes, la tormenta y sus resultados son simulados. El logo visible es NASA Space Apps Challenge.

La suite actual comprueba 64 combinaciones lunares y 32 marcianas, persistencia, ambas decisiones, bloqueo del robot, éxito/fallo del mantenimiento, consumo, consultas WMTS con red/caché/error, extractos científicos y el final. Revisión visual de Marte realizada en navegador a 1280×800, 390×844 y 844×390. Mars Trek sirvió imágenes en línea; PDS Search no permitió la lectura desde el navegador y el panel mostró el respaldo histórico sin afirmar una conexión exitosa.
