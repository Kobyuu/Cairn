# PLAN-landing — ejecución

> Spec: [`SPEC-landing.md`](../specs/SPEC-landing.md) · Issue #3

Cortes verticales. El orden es por dependencia: la página se puede escribir
entera con los `<picture>` apuntando a archivos que todavía no existen, y las
capturas entran después sin tocar el markup.

---

## T1 · Esqueleto del sitio y sistema visual

**Archivos:** `site/styles.css`, `site/index.html` (cabeza + nav + pie),
`site/robots.txt`, `site/sitemap.xml`, `vercel.json`.

- Tokens del sistema web como custom properties, escala tipográfica, grilla,
  utilidades de sección, motion con `prefers-reduced-motion`.
- `<head>` completo: `lang="es"`, title y description del brief, canonical, OG,
  Twitter card, JSON-LD `SoftwareApplication`, preconnect + Google Fonts.
- Barra de Ambiente fija de 3 px al 62 %, `aria-hidden`, sin animación.
- Nav y pie.

**Aceptación:** `site/index.html` abre en el navegador con la tipografía
correcta, fondo `#0B0C0B`, nav y pie maquetados, sin errores en consola.

## T2 · Las ocho secciones

**Archivos:** `site/index.html`, `site/styles.css`.

Héroe · tres modos · el ciclo · la rutina · tres razones · preguntas · cierre.
Sin sección de precio. Copy literal del handoff. El acordeón es
`<details name="faq">` con la primera abierta. Los `<picture>` de las capturas
quedan escritos con sus `width`/`height` definitivos.

**Aceptación:** las siete secciones renderizan en el orden de la spec §4, el
acordeón abre una y cierra las otras sin una línea de JS, y ningún color del
CSS está fuera de los tokens.

## T3 · Responsive y accesibilidad

**Archivos:** `site/styles.css`.

Cortes 1024 / 900 / 700. Debajo de 700, la captura de Foco escala con
`transform` desde el centro y no se reflowea. `:focus-visible`, contraste,
`prefers-reduced-motion`.

**Aceptación:** en 1240 / 1024 / 900 / 700 / 380 no hay scroll horizontal y
ningún texto se corta. Con reduced-motion la página está quieta.

## T4 · Capturas reales de la app

**Archivos:** `site/img/*.png|webp`, `notes/routine.md` de la máquina (temporal).

Se corre la app y se captura con PowerShell:

1. Rutina de referencia («Corrección de postura») en el archivo de notas.
2. **Foco** — dejar vencer el ciclo, esperar 84 s, capturar a pantalla completa → `01:24`.
3. **Widget** — `interval_min = 27`, arrancar, capturar sobre una ventana ajena → `27`.
4. **Ambiente** — `interval_min = 1`, capturar el borde superior a los 11 s / 37 s / 56 s → 18 % / 62 % / 93 %.
5. **Rutina** — panel en lectura y en edición.

Recorte a los marcos A / B / C, exportar PNG a 2× y WebP.

**Aceptación:** los números de las capturas son los de la spec §6, la barra de
Ambiente está a grosor real, y las imágenes entran en los `<picture>` de T2 sin
cambiar el markup.

## T5 · OG image y cierre

**Archivos:** `site/img/og.png`, `docs/DESIGN.md`, `docs/BACKLOG.md` (nada), README.

OG 1200 × 630: fondo `#0B0C0B`, mojón arriba a la izquierda, la promesa en
Newsreader 300 a 56 px, tira de Ambiente al 62 % en el borde superior.
Corregir en `DESIGN.md` §6 la línea de «contenido en datos» (spec §2) y marcar
la landing como hecha en §7.

**Aceptación:** los cinco comandos de CLAUDE.md §7 en verde y la checklist
manual completa.

---

## Lo que se desvió del plan, y por qué

- **T3 · La captura de Foco no necesita `transform: scale()`.** Siendo una imagen
  real, `width:100%` + `height:auto` ya la escala desde el centro conservando la
  relación de aspecto: no hay nada que reflowear. Se corrigió `DESIGN.md` §6.
- **La relación es 16/9, no 16/10.** Es la de la pantalla capturada. Recortar a
  16/10 cortaba el título de la rutina, que va a 32 px del borde superior.
- **Se agregó un corte en 480 px** para la nav: con el logo, dos anclas y el
  botón no entraba. Debajo de 480 las anclas se ocultan (en una sola pantalla
  sobran).
- **Las etiquetas de las tiras de Ambiente van debajo, no encima.** El prototipo
  las apoya sobre un gradiente vacío; sobre una captura real de escritorio se
  pisan con el contenido de la ventana.
- **Sin WebP.** No hay codificador en la máquina (ni `cwebp`, ni `ffmpeg`, ni
  ImageMagick) y agregar uno es una dependencia que necesita el OK de §5. Las
  imágenes se sirven en PNG y los `<source>` se sacaron: un `<source>` apuntando
  a un archivo inexistente rompe la imagen entera, no degrada.
- **La imagen de OG se generó abriendo `site/og.html` en una ventana `--app` del
  navegador y capturándola con `PrintWindow`.** Queda `site/og.html` como fuente
  para regenerarla.

## Checklist de verificación manual

- [ ] `site/index.html` abre a doble click, sin servidor, y se ve completa.
- [ ] El acordeón: abre una pregunta y cierra la anterior. Con `Tab` + `Enter` también.
- [ ] La barra de Ambiente de arriba **no se mueve** nunca.
- [ ] `01:24` en Foco y `27` en el Widget, en todas las apariciones.
- [ ] 1240 / 1024 / 900 / 700 / 380 px: cero scroll horizontal.
- [ ] Debajo de 700 px la captura de Foco escala, no se reordena.
- [ ] Con «reducir movimiento» activado en el sistema, nada respira.
- [ ] El CTA dice PRÓXIMAMENTE y no es clickeable. No hay sección de precio.
- [ ] Vista de código fuente: el texto de las ocho secciones está en el HTML servido.
