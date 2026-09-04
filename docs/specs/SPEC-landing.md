# SPEC-landing — Landing pública de Cairn

> Issue [#3](https://github.com/Kobyuu/Cairn/issues/3) · `stage:landing` · `area:web`
> Fuera del capability map: no es una etapa 7, es otro producto. La app no se toca.

## 1. Objetivo

Publicar una página estática que explique Cairn y sostenga su argumento de venta:
el ciclo no se reinicia solo. Una sola página, ocho secciones, sin backend, sin
cuentas y sin analítica.

La forma ya está resuelta en alta fidelidad en
`docs/design_handoff_cairn_landing/Cairn Landing.dc.html` y el copy **se publica
tal cual**. Esta spec no rediseña nada: define el stack, los límites y cómo se
verifica.

## 2. Decisiones (cerradas)

| Decisión | Elegido | Por qué |
| --- | --- | --- |
| Repo | carpeta `site/` en este repo | Los tokens web extienden los de la app, el kit exige los mismos números en toda la web, y la descarga va a apuntar a un release de acá. |
| Stack | HTML + CSS a mano, **sin build** | La página es una sola, y su único interactivo (el acordeón de preguntas) es `<details name>` nativo. Un framework agregaría un segundo `package.json` → `pnpm-workspace.yaml` con `packages:` → monorepo, contra CLAUDE.md §1. |
| Hosting | Vercel, publish dir `site/`, build command vacío | Publica desde repo privado o público, subdominio gratis, y no obliga a workflow como GitHub Pages. Cloudflare Pages es equivalente. |
| CTA | **descarga real** al release `v0.1.0` | Desbloqueado por [#16](https://github.com/Kobyuu/Cairn/issues/16): ya hay instalador NSIS. Los tres botones (nav, héroe, cierre) apuntan al `.exe` del GitHub Release, con el peso real (2,7 MB) y una nota honesta sobre el aviso de SmartScreen, porque no se firma (`docs/specs/SPEC-distribution.md` §4). |
| Sección de precio | **sigue sin publicarse** | Cambió el motivo: antes faltaba el checkout, ahora **el producto es gratis**. En el pie hay un enlace de propina. La sección de precio vuelve recién si sale el pack de temas del release 2. |
| Fuentes | Google Fonts por `<link>` | La prohibición de red es de la app, no de la web (`docs/DESIGN.md` §2 y §5). |

### Desvío deliberado del handoff

`docs/DESIGN.md` §6 dice *«el contenido va en datos, no en el markup»*. Eso
describe el prototipo, que es un componente con estado. En HTML plano cumplirlo
obligaría a renderizar por JavaScript, y una página cuyo argumento es «no hay
servidor» no puede depender de JS para mostrar su texto: rompe el SEO y el
no-JS. **El markup es los datos.** Se corrige esa línea de `DESIGN.md`.

## 3. Alcance

### Entra

- `site/index.html` — las ocho secciones, menos precio (§2).
- `site/styles.css` — tokens del sistema web, escala tipográfica, grilla, motion.
- **Capturas reales exportadas de la app**, con los marcos A / B / C del kit.
  Reemplazan las recreaciones HTML/CSS del prototipo. Se sirven en **WebP**
  (`cwebp`, instalado fuera del repo en `D:\Programas\libwebp`): las de UI en
  **lossless** —tipografía fina sobre fondo oscuro es donde el lossy se
  ensucia— y las tiras de Ambiente en **lossy `-q 90 -sharp_yuv`**, porque
  detrás hay un fondo de escritorio fotográfico y ahí lossless *engorda*: 15 KB
  de PNG plano se volvían 182 KB. El resultado son 650 KB de imágenes contra
  1,3 MB en PNG.
- OG image 1200 × 630.
- `robots.txt`, `sitemap.xml`, favicon, `site.webmanifest` no.
- SEO: `title`, `description`, `canonical`, Open Graph, Twitter card, JSON-LD
  `SoftwareApplication`, `lang="es"`, jerarquía real de headings, `alt` honestos.
- `vercel.json` mínimo si hace falta cabecera de caché.

### No entra

- Ningún cambio en `src/`, `src-tauri/` ni en el `.exe`.
- Formularios, lista de espera, correo. Implicaría un tercero y es #16.
- Analítica de cualquier tipo (CLAUDE.md §2).
- Inglés. Sólo español (voseo). Si aparece, ahí sí se evalúa Astro.
- Blog, changelog como página, comparativas, testimonios.

## 4. Estructura de la página

| # | Sección | Estado |
| --- | --- | --- |
| — | Barra de Ambiente fija de 3 px arriba | 62 %, **nunca se anima** |
| — | Nav | logo, MODOS · PREGUNTAS · `DESCARGAR` (sale PRECIO) |
| 1 | Héroe | promesa + subtítulo + CTA `DESCARGAR PARA WINDOWS` + peso y nota de SmartScreen + captura de Foco en marco A |
| 2 | Los tres modos | Ambiente (marco C ×3) · Widget (marco B) · Foco |
| 3 | El ciclo | cuatro estados en línea; la flecha vuelve sólo desde «confirmás» |
| 4 | La rutina | lectura + edición, dos capturas |
| 5 | Las tres razones | tres tarjetas |
| ~~6~~ | ~~Precio~~ | **omitida** (§2) |
| 6 | Preguntas | 5, acordeón `<details name="faq">`, la primera abierta |
| 7 | Cierre | mojón + «La próxima pausa puede esperarte.» + CTA |
| 8 | Pie | logotipo · CÓDIGO · NOVEDADES (releases) · INVITAME UN CAFÉ |

## 5. Sistema visual

De `Cairn Sistema Web.dc.html`, como custom properties en `styles.css`:

- **Base:** tinta `#E9E4D8` · fondo `#0B0C0B` · acento `oklch(0.76 0.05 150)`.
- **Superficies:** `rgba(233,228,216,.03 / .06)`; líneas `.12` y `.20`.
- **Estados:** hover `oklch(0.82 0.055 150)`, activo `oklch(0.70 0.05 150)`,
  foco `oklch(0.76 0.05 150 / .35)`.
- **Escala:** display 84/1.02/-.02em · h1 56/1.08 · h2 34/1.2 · h3 26/1.25 ·
  cuerpo Newsreader 17/1.75 · cuerpo-s Mono 13/1.9 · etiqueta Mono 10/.3em.
- **Grilla:** máx 1240, texto máx 680, margen 64 (24 en móvil), secciones 160 px
  de aire (96 en móvil). Espaciado 4·8·12·16·24·40·64·96·160.
- **Movimiento:** respiración 5,5 s ease-in-out (el único ritmo). Entradas
  opacidad 0→1 en 500 ms + 12 px. Hover 150 ms, sólo color, nunca escala.
  Prohibido parallax, contadores animados y carruseles.
- **Reglas duras heredadas de CLAUDE.md §5:** ningún color hardcodeado fuera de
  los tokens, nada en negrita (300 y 400), todo número con `tabular-nums`.

Fondo `#0B0C0B` en toda la página: **no hay secciones claras**.

## 6. Capturas

De la app **real**, tema oscuro, y los mismos números en toda la web.

El fondo de las tres tiras es el escritorio real, sin ventanas ni íconos.

| Marco | Contenido | Números |
| --- | --- | --- |
| A | Foco vencido, a pantalla completa | `01:24`, rutina «CORRECCIÓN DE POSTURA» |
| B | Widget sobre una ventana ajena, esquina inferior derecha a 44 px | `27` MIN RESTANTES |
| C | Tira superior de Ambiente ×3 | 18 % · 62 % · 93 % (esta a 5 px, respirando) |
| A recortado | Rutina en lectura y en edición | 2 de 5 hechas |

Reglas: WebP (ver §3), servido con `<img>` y sus `width`/`height` reales para
que la página no salte al cargar. Sin `<picture>` ni respaldo PNG: WebP tiene
soporte universal desde 2020 y duplicar cada archivo por un navegador que no
existe es peso muerto. La excepción es `og.png`, que sigue en PNG porque varios
lectores de tarjetas sociales todavía no leen WebP. La barra de Ambiente se muestra a
**su grosor real** —medida pixel a pixel en las tres tiras: 3 px al 18 % y al
62 %, 5 px al 93 %— y si no se ve se agranda el encuadre, nunca la barra. Nunca
marcos de macOS, manos sosteniendo pantallas ni perspectiva 3D.

## 7. Responsive

Resuelto a 1240 px. Cortes en **1024 / 900 / 700**, más uno en **480** donde las
anclas de la nav se ocultan (en una sola pantalla sobran). La captura de Foco
**no se reflowea**: siendo una imagen real, `width:100%` con `height:auto` ya la
escala conservando su relación de aspecto, sin `transform`. Esa relación es la
de la pantalla capturada (**16/9**), no 16/10: recortar a 16/10 comía el título
de la rutina, que va a 32 px del borde superior.

## 8. Accesibilidad

- **Contraste AA (4,5:1) sobre `#0B0C0B` en todo el texto que se lee y en todo
  lo que se clickea.** El handoff pinta varias piezas más tenues de lo que eso
  permite —a 10 px, `--ink-40` da 3,2:1 y `--ink-26` da 2,0:1— así que se
  subieron a `--ink-56` (5,3:1) las etiquetas, los pies de las capturas y la
  nota de plataforma, y a `--ink-66` los enlaces de la nav y del pie. Es una
  desviación consciente del handoff: revertirla es cambiar esos tokens.
  Queda **debajo de AA a propósito** y no es texto: el punto del ciclo
  (`--ink-30`, decorativo). La nota del aviso de SmartScreen **no** se atenúa:
  hereda el `--ink-56` de `.note` porque es la instrucción que hace que la
  descarga funcione, no una aclaración al pie.
  _(El botón `PRÓXIMAMENTE` que esta lista eximía por estar `disabled` ya no
  existe: desde #16 los tres CTA son enlaces de descarga reales, §2.)_
- `:focus-visible` con el anillo del sistema (outline 2px al 35 %, offset 3).
- El acordeón es `<details>/<summary>` nativo: teclado y lector de pantalla salen gratis.
- `prefers-reduced-motion: reduce` apaga la respiración y las entradas.
- La barra de Ambiente es decorativa: `aria-hidden`, sin foco.

## 9. Verificación

**Automática** — los cinco comandos de CLAUDE.md §7 tienen que seguir en verde:
`pnpm lint` · `pnpm typecheck` · `pnpm test` · `cargo clippy` · `cargo test`.
`site/` no agrega comandos porque no agrega toolchain; sí hay que confirmar que
no lo rompe (que `eslint` y `tsc` no lo levanten).

**Manual** — checklist en el plan: la página abre sin servidor
(`site/index.html` a doble click; por eso las rutas son relativas), el acordeón
abre uno y cierra el resto sin JS, los cinco breakpoints no desbordan en
horizontal, la barra de Ambiente no se anima, los números coinciden en toda la
página, y con `prefers-reduced-motion` no se mueve nada.

## 10. Límites

- Ninguna llamada saliente además de Google Fonts.
- Cero JavaScript propio. Si algo necesita JS, se replantea la sección.
- Nada de `<img>` sin `width`/`height`: la página no puede saltar al cargar.
