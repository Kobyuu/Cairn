# Cairn — marca

## logo/
- `cairn.ico` — icono de Windows, 16→256 en un archivo (variante clara).
- `cairn-mojon-*.svg` — el mojón vectorial (grilla de 32).
- `png/` — el mojón, 16→1024 px, fondo transparente.

## logo/logotipo/
- `cairn-logotipo-*.svg` — sólo la palabra.
- `cairn-lockup-h-*.svg` — mojón + palabra, horizontal.
- `cairn-lockup-v-*.svg` — mojón + palabra, vertical.
- `png/` — los tres, 128 / 256 / 512 px de alto tipográfico, fondo transparente.

## Variantes
- **claro** `#E9E4D8` + acento `#A9C7B3` — para fondos oscuros.
- **oscuro** `#1A1C19` + acento `#5F7C68` — para fondos claros.
- **mono-blanco** / **mono-negro** — una sola tinta.

## Tipografía
Newsreader 300, tracking .06em (.08em en el lockup vertical). Los SVG traen `@import` de Google Fonts: si el destino no tiene conexión o no resuelve fuentes web, usar los PNG o convertir el texto a curvas.

## Reglas
- Área de resguardo: una altura de x en los cuatro lados.
- Tamaño mínimo: lockup 18 px de alto, logotipo solo 14 px.
- El mojón nunca va dentro de la palabra ni cambia de proporción: alto del mojón = alto de mayúscula.
