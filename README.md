# OUTPOST · Beyond the Mission

Prototipo web de una expedición lunar. Tras la pantalla de inicio y su cinemática, Curiosity y Neil Armstrong te reciben en la nave. Elige la Luna para continuar con una tripulación de cinco personas.

## Cómo abrirlo

Sirve la carpeta con cualquier servidor HTTP estático y abre `index.html`. Por ejemplo, con Python instalado:

```sh
python -m http.server 8000
```

Entra a <http://localhost:8000>. `inicio.html` contiene la pantalla y cinemática originales. Si abres el proyecto directamente desde el disco y tu navegador bloquea la transición, usa «Ir a la nave» o abre `juego.html`.

- En la nave, avanza el diálogo con el botón, Enter o la barra espaciadora.
- En la Luna, muévete con WASD, las flechas o los botones en pantalla.
- Acércate al marcador amarillo y pulsa **E** o **Interactuar**.
- Revisa cómo cada decisión cambia la energía, el oxígeno y la radiación.
