# Cairn

App de escritorio para Windows 10/11 que cada 45 minutos avisa que es hora de una
pausa. **El ciclo se reinicia solo cuando confirmás que terminaste** — no cuando
se cumple el tiempo. El intervalo es configurable, así que sirve igual como
pomodoro o para cronometrar cualquier otra cosa.

Nació para una rutina de corrección de postura.

> **Estado: la app está completa.** Las seis etapas del capability map están
> cerradas: temporizador, bandeja, los tres modos de presencia, la rutina en
> markdown y el diseño aplicado. Todavía no hay distribución — no hay instalador
> ni release ([#16](https://github.com/Kobyuu/Cairn/issues/16)), así que por
> ahora se corre desde el código.

## Cómo funciona

Un temporizador corre en segundo plano. Al vencer, Cairn conmuta a la pantalla
de **Foco** —que *es* el aviso: no hay toast del sistema encima— donde un
cronómetro cuenta hacia arriba para medir cuánto duró la pausa. Desde ahí:
**Listo** (reinicia el ciclo), **posponer** los minutos rápidos, o posponer una
cantidad arbitraria.

### Tres modos de presencia, intercambiables desde la bandeja

| Modo         | Qué es                                                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Foco**     | Pantalla completa, siempre encima. Es el aviso.                                                                                       |
| **Widget**   | Ventana chica sin bordes, arrastrable, que recuerda su posición.                                                                      |
| **Ambiente** | Sin ventana visible: una franja de 3 px en el borde superior de la pantalla que muestra el avance del ciclo. Atravesable por el mouse. |

Cambiar de modo **nunca** reinicia la cuenta.

### Rutina

Un documento markdown editable desde la app, colapsado por defecto en Foco, con
soporte de listas con casillas. Se guarda como un `.md` real en disco, no como
una cadena dentro de la configuración — porque va a crecer hacia un espacio de
notas y tareas.

## Stack

**Tauri v2** (el `.exe` es un proceso Rust que hospeda ventanas de WebView2) +
**React** + **TypeScript** + **Vite** + **Tailwind v4**. Solo Windows.

El estado del temporizador vive en el core de Rust; las tres ventanas son vistas
que se suscriben a eventos. El vencimiento se guarda como un instante en hora de
pared y el tiempo restante se deriva comparando contra el reloj del sistema, así
que sobrevive a que la PC se suspenda y despierte.

## Empezar

**Prerrequisitos:**

- [Rust](https://rustup.rs) con el toolchain `stable-x86_64-pc-windows-msvc`
- **MSVC C++ Build Tools** (Visual Studio Build Tools → "Desarrollo para el
  escritorio con C++"). Tauri linkea con el linker de MSVC, no con GNU.
- **WebView2 Runtime** — ya viene con Windows 11
- Node y **pnpm** (el proyecto usa pnpm, no npm)

```bash
pnpm install
pnpm tauri dev      # desarrollo
pnpm tauri build    # .exe en src-tauri/target/release/
```

**Verificación completa** — los cinco tienen que estar en verde:

```bash
pnpm lint
pnpm typecheck
pnpm test
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
cargo test  --manifest-path src-tauri/Cargo.toml
```

## Documentación

| Documento                                                            | Qué contiene                                                    |
| -------------------------------------------------------------------- | --------------------------------------------------------------- |
| [`docs/architecture.md`](docs/architecture.md)                       | Las decisiones D1–D9 y por qué se tomaron                       |
| [`docs/specs/CAPABILITY-MAP.md`](docs/specs/CAPABILITY-MAP.md)       | Los seis módulos, su orden de construcción y las reglas comunes |
| [`docs/specs/`](docs/specs/)                                         | Una spec por etapa, con criterios de aceptación y tests         |
| [`docs/DESIGN.md`](docs/DESIGN.md)                                   | **Sistema de diseño, normativo.** Lectura obligatoria antes de tocar `src/` |
| [`docs/design_handoff_cairn/`](docs/design_handoff_cairn/)           | Handoff de Claude Design: las cuatro pantallas, la marca, el sistema web y el kit de capturas |
| [`docs/design_handoff_cairn_landing/`](docs/design_handoff_cairn_landing/) | Handoff de la landing, en alta fidelidad y con el copy final |
| [`CLAUDE.md`](CLAUDE.md)                                             | Reglas del agente: flujo de trabajo, subagentes, herramientas   |

## Hoja de ruta

1. **`bootstrap`** — proyecto que compila y produce un `.exe`
2. **`timer-core`** — el ciclo completo, con UI mínima
3. **`system-integration`** — bandeja, instancia única, ajustes, autostart
4. **`presence-modes`** — los tres modos y la conmutación
5. **`routine`** — la rutina en markdown
6. **`visual-design`** — el handoff aplicado

Fuera del capability map, porque es otro producto: la **landing pública** en
[`site/`](site/) — HTML plano sin build, se publica sirviendo esa carpeta.

Después: la rutina crece hacia un espacio de notas, tareas y recordatorios en
markdown, estilo Notion pero mínimo.

## Datos

Todo local, sin backend, sin red, sin telemetría. Los ajustes van a `store.json`
y el contenido a `notes/*.md`, ambos en el directorio de datos de la app — texto
plano que podés abrir con el Bloc de Notas.

## Licencia

Sin definir. Proyecto personal.
