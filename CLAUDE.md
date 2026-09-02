# Reglas del Agente (CLAUDE.md)

Este documento contiene las reglas **inquebrantables** del proyecto **Cairn** — una app de escritorio para Windows 10/11 que avisa cuándo es hora de una pausa y mide cuánto dura. Cualquier IA o desarrollador que trabaje en esta base de código **DEBE** respetar estas directrices antes de escribir una sola línea de código.

> La arquitectura completa y razonada vive en [`docs/architecture.md`](docs/architecture.md); el mapa de capacidades y las specs por etapa en [`docs/specs/`](docs/specs/); los planes de ejecución en `docs/plans/`. Este archivo es el resumen normativo.

## 1. Arquitectura y Stack

- **Estructura:** repo único, sin monorepo. Un solo `package.json` en la raíz y un solo crate de Rust en `src-tauri/`.
- **Package Manager:** uso **EXCLUSIVO** de `pnpm`. Prohibido `npm` o `yarn` en cualquier comando para no corromper el lockfile.
- **Framework:** **Tauri v2**. El `.exe` es un proceso Rust (el *core*) que hospeda ventanas de **WebView2** (el motor de Edge). Se hablan por IPC: el frontend llama `invoke("comando")` para ejecutar funciones Rust; Rust hace `emit("evento", payload)` para avisarle a las ventanas.
- **Frontend:** **React + TypeScript + Vite + Tailwind v4**. Un solo bundle sirve a las tres ventanas, que se diferencian por query param (`index.html?view=foco|widget|ambient`).
- **Core:** **Rust**, en archivos chicos (`lib.rs`, `timer.rs`, `modes.rs`, `settings.rs`, `routine.rs`, `main.rs`). Ninguno grande: si uno crece, es señal de que hace demasiado.
- **Target: solo Windows 10/11.** No escribir código condicional para macOS o Linux, ni "por si acaso". Si algún día hace falta, se agrega entonces.
- **Estado en el core, ventanas como vistas.** El estado del temporizador vive en Rust detrás de un `Mutex` en `app.manage()`. Las ventanas son vistas que se suscriben a eventos y **no** guardan estado propio del ciclo. Razonado en `docs/architecture.md` §D1.

## 2. Reglas de Producto (Inquebrantables)

- **El ciclo NO se reinicia solo.** Al vencer, el temporizador queda en `Elapsed` y ahí se queda hasta que Manu confirme ("Listo") o posponga. Un reinicio automático al vencer convierte a Cairn en un reloj que ignorás; el valor entero de la app es que exige el acto de confirmar.
- **Cambiar de modo NUNCA reinicia la cuenta.** Es la propiedad que justifica toda la arquitectura de §1. Cualquier cambio que la rompa está mal por definición, no importa qué otra cosa arregle.
- **El tiempo se deriva de un instante de vencimiento, jamás de un contador acumulado.** Prohibido `setInterval` que sume segundos, y prohibido `std::time::Instant` para el vencimiento. Se guarda `deadline_ms` (epoch Unix en ms, hora de pared) y el restante es siempre `deadline_ms - ahora`. Motivo en `docs/architecture.md` §D2: `Instant` en Windows es `QueryPerformanceCounter` y **no avanza mientras la máquina duerme**, así que con `Instant` suspender dos horas dejaría el temporizador intacto.
- **Cerrar una ventana no cierra la app.** `CloseRequested` → `prevent_close()` + `hide()`. La única salida real es "Salir" en el menú de la bandeja.
- **La rutina es un archivo `.md` real en disco**, en un directorio de notas — nunca una cadena dentro de la configuración. Va a crecer hacia un espacio de notas/tareas estilo Notion mínimo, y la decisión de almacenamiento no debe obligar a migrar después.
- **Los datos son locales y del usuario.** Cairn no tiene backend, no hace red y no telemetriza. Cualquier propuesta que agregue una llamada saliente necesita decisión explícita de Manu.

## 3. Persistencia

- **Ajustes:** `tauri-plugin-store` → `store.json` en el directorio de datos de la app. Guarda **solo ajustes**: `interval_min`, `default_mode`, `quick_snooze_min`, `widget_pos`, `autostart`, `theme`.
- **Contenido:** archivos `.md` reales en `<app_data_dir>/notes/`. La rutina es `notes/routine.md`. Escribir siempre a temporal + rename atómico: un corte de luz a mitad de un `write` no puede dejar la rutina truncada.
- **Nada de base de datos.** No proponer SQLite, Postgres ni un ORM. Son archivos de texto de kilobytes que el usuario tiene que poder abrir con el Bloc de Notas.

## 4. Build y Distribución

- **Requisitos de la máquina de desarrollo** (Manu los instala, el agente no puede):
  - **Rust** vía `rustup` (toolchain `stable-x86_64-pc-windows-msvc`).
  - **MSVC Build Tools** (Visual Studio Build Tools con la carga "Desarrollo para el escritorio con C++"). Tauri linkea con el linker de MSVC, no con GNU.
  - **WebView2 Runtime** — ya presente en Windows 11 moderno.
- **Comandos:** `pnpm tauri dev` para desarrollo; `pnpm tauri build` produce el `.exe` y el instalador en `src-tauri/target/release/`.
- **Distribución:** por ahora ninguna. No configurar firma de código, actualizador automático (`tauri-plugin-updater`) ni instalador MSI/NSIS hasta que Manu lo pida. Es una app personal.
- **Sin CI todavía.** No crear workflows de GitHub Actions ni CircleCI sin pedirlo. La verificación es local (§7).

## 5. Prácticas de Código

- **Avisar ANTES de agregar cualquier dependencia**, de Rust o de JS, sin excepción. Nombrarla, decir qué resuelve, y qué costaría hacerlo a mano. Esperar el OK. Vale también para features nuevas de un crate ya presente.
- **Explicar las decisiones del core de Rust.** Manu no sabe Rust ni Tauri. Cuando el agente elija un tipo, un patrón de concurrencia, un `enum` en vez de flags, o cualquier cosa que no sea obvia, lo explica en una o dos frases. **No dar por sentada la terminología de Tauri**: la primera vez que aparezca "capability", "webview", "IPC", "AppHandle", "emit/listen", se define en línea.
- **Tipado:** TypeScript estricto. Prohibido `any` salvo justificación por librería externa. En Rust, prohibido `unwrap()` fuera de tests y de `setup()`; usar `?` o `let else` con log.
- **`unsafe` está prohibido** salvo decisión explícita de Manu. Todo lo que necesitamos de Win32 ya está envuelto por Tauri (ver §11).
- **Idiomas:** código (variables, funciones, archivos) en **inglés**. Documentación y comentarios largos en **español**.
- **Lint:** `eslint` + `@typescript-eslint` con `--max-warnings 0` para TS; `cargo clippy -- -D warnings` para Rust. Un warning rompe el build. `cargo fmt` y `prettier` no se discuten.
- **Diseño y estilo visual: `docs/DESIGN.md` es NORMATIVO y de lectura obligatoria antes de tocar `src/`.** El handoff de Claude Design ya llegó (`docs/design_handoff_cairn/` y `docs/design_handoff_cairn_landing/`) y `docs/DESIGN.md` es su destilación operativa: dirección visual (**Aliento**), tokens, escala tipográfica, movimiento y las cinco pantallas. Reglas duras que salen de ahí:
  - **Prohibido hardcodear un color.** Todo sale de los tokens de `src/index.css`. Un color que no existe se agrega como token, no como hex suelto.
  - **Prohibido `currentColor` dentro de `color-mix`**: no resuelve contra un `color` en línea y rompe el tema claro.
  - **Nada en negrita** (los pesos son 300 y 400) y **todo número lleva `tabular-nums`**.
  - Los `.dc.html` del handoff son **referencias**, no código para copiar: se recrea el diseño con React + Tailwind v4.
  - Ante una contradicción entre `docs/DESIGN.md` y el handoff, gana el handoff y **se corrige `DESIGN.md`**.
  - **Skill `ui-ux-pro-max` (alcance acotado):** solo para movimiento/animación, microinteracciones y patrones de UX. Sus paletas y tipografías **NO se adoptan** — la identidad visual sale del handoff de Claude Design.

## 6. Flujo de Trabajo y Git (Conventional Commits)

- **Mensajes Semánticos:** todos los commits siguen **Conventional Commits** (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`).
- **Confirmación para Git (commit / push / PR):** NUNCA hacer `commit`, `push` ni abrir un Pull Request sin la confirmación explícita de Manu. El agente prepara los cambios y **espera permiso**. Una vez otorgado, ejecutar **todo el flujo de corrido** (commit → push → PR) sin pedir confirmaciones intermedias.
- **Sin commits automáticos en NINGUNA rama:** el agente NUNCA commitea por su cuenta, ni en feature branches ni en `main`. Por defecto deja los cambios **en el working tree sin commitear** para que Manu los revise desde el IDE. Solo commitea cuando Manu lo pide explícitamente.
- **Ramas:** `main` es la rama por defecto. El trabajo va en `feat/...`, `fix/...`, `docs/...` y entra por Pull Request. _(Dev solo: auto-merge tras verificación en verde.)_ El commit inicial del proyecto fue la única excepción.
- **Gestión de PRs:** al abrir un PR, usar `gh pr edit` para auto-asignarlo a `@Kobyuu` y aplicar las labels (ver tabla).
- **Cierre de Issues:** el cuerpo del PR DEBE incluir la palabra clave de cierre apuntando al Issue (`Closes #N`). No cerrar Issues a mano.
- **Gestión del Backlog:** las ideas sueltas se anotan en `docs/BACKLOG.md`. Al procesarlo, el agente DEBE, **ítem por ítem**: (1) preguntarle a Manu lo necesario para entender la tarea **antes** de crear nada; (2) transformarla en una Spec modular en `docs/specs/`; (3) crear el Issue con `gh` aplicando labels. Al terminar, vaciar `BACKLOG.md`.
- **Labels de Issues (obligatorio al crear cualquier issue):**

  | Grupo          | Labels disponibles                                                                                                | Cardinalidad                      |
  | -------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------- |
  | **Naturaleza** | `enhancement` · `chore` · `bug`                                                                                   | exactamente 1                     |
  | **Etapa**      | `stage:1-bootstrap` · `stage:2-timer` · `stage:3-system` · `stage:4-modes` · `stage:5-routine` · `stage:6-design` · `stage:landing` | exactamente 1                     |
  | **Área**       | `area:rust-core` · `area:ui` · `area:windows` · `area:persistence` · `area:build` · `area:testing` · `area:web`   | 1 o más                           |
  | **Prioridad**  | `priority:critical`                                                                                               | solo si bloquea la etapa en curso |

  Asignación de área: `area:rust-core` si toca `src-tauri/src/`; `area:ui` si toca `src/`; `area:windows` si toca geometría de ventanas, bandeja, DPI o foco; `area:persistence` si toca `store.json` o `notes/`; `area:build` si toca Vite, Cargo, `tauri.conf.json` o toolchain; `area:testing` si el objetivo principal es escribir o configurar tests.

  Todo issue se auto-asigna a `@Kobyuu` (`--assignee Kobyuu`). Si una label no existe, crearla con `gh label create`, **documentarla en esta tabla** y recién entonces aplicarla.

## 7. Testing y Verificación

- **SDD + TDD son obligatorios** (decisión de Manu, 2026-09-02 — **reemplaza el régimen previo donde TDD era opt-in**). Toda etapa entra por su spec en `docs/specs/`, y toda lógica no trivial entra por un test que falla primero. `superpowers:test-driven-development` y `agent-skills:spec-driven-development` pasan de opt-in a canónicos (§9.2/§9.3).
- **Qué se testea, y con qué:**
  - **`src-tauri/src/timer.rs` → `cargo test`, y es lo más importante del repo.** La máquina de estados es aritmética pura sobre `u64` de epoch-ms: se testea **inyectando el "ahora" como parámetro**, sin dormir el hilo y sin tocar el reloj real. Casos obligatorios: vencimiento exacto, despertar con el vencimiento pasado por menos de un intervalo, despertar por más de un intervalo (reinicio silencioso), pausa y reanudación, posponer rápido y arbitrario, y reloj que salta para atrás.
  - **Frontend → `vitest`.** La derivación del restante a partir de `deadline_ms` y el formateo, que es donde se cuelan los off-by-one.
  - **Ventanas, bandeja y DPI → verificación manual.** No hay test automático razonable para "la franja quedó de 4px en el monitor primario al 150%". Se verifica a mano con la checklist de la spec de la etapa.
- **Los comandos de la verificación completa:** `pnpm lint` · `pnpm typecheck` · `pnpm test` · `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings` · `cargo test --manifest-path src-tauri/Cargo.toml`. Los cinco en verde antes de dar algo por terminado. **`typecheck` no es redundante con `test`**: vitest transpila sin chequear tipos, así que una suite entera puede pasar con el proyecto roto.
- **Cómo Testear lo Hecho (Obligatorio):** al terminar **cualquier** tarea, el agente DEBE indicarle a Manu **cómo verificar lo realizado**: los comandos exactos, los pasos manuales para reproducirlo (qué abrir, qué apretar, qué esperar) y los tests agregados. Ninguna tarea se cierra sin estas instrucciones.
- **Trabajo por etapas, con parada obligatoria.** El proyecto avanza en las seis etapas del capability map. Al terminar cada una, el agente **frena y entrega la checklist de verificación manual** para que Manu la pruebe. No se arranca la etapa siguiente sin su OK. Esto **no** contradice §10.0: dentro de una etapa se trabaja de corrido; el corte es entre etapas.

## 8. Clean Code y Comunicación

- **Principios:** SOLID y DRY, pero **subordinados a Ponytail** (§9): no abstraer para un solo uso, no crear una interfaz con una implementación, no configurar un valor que nunca cambia. Extraer a una utilidad compartida recién en el segundo uso real, no en el primero anticipado.
- **Eficiencia de Tokens:** respuestas concisas y directas. Evitar explicaciones redundantes y saludos largos. Hablar menos, codificar más. **La excepción es §5:** las decisiones del core de Rust y la terminología de Tauri se explican siempre, porque ahí la explicación es el entregable.

## 9. Selección de Modelo por Subagente

El modelo se elige **por criticidad de la tarea**, no por tipo de trabajo:

- **Orquestación, planificación y revisión** (sesión principal): **Opus 5** (`claude-opus-5`).
- **Implementación de lógica crítica/sensible → Opus 5.** Cubre: `timer.rs` entero (la máquina de estados y todo lo que toque relojes), la geometría de ventanas y el cálculo de DPI en `modes.rs`, el ciclo de vida de la app en `lib.rs`, y la escritura atómica de `routine.rs`. No ahorrar modelo donde un bug es invisible: un temporizador que deriva de a poco no se nota hasta que ya te falló diez veces.
- **Implementación de boilerplate/bajo riesgo → Sonnet 5.** Cubre: componentes de React que solo pintan, wiring de ajustes, configs, estilos, y tests rutinarios.
- **Exploración/lectura** (búsqueda de código, mapeo de archivos, responder "dónde está X"): **Sonnet 5**.
- **Override explícito** de Manu o del orquestador **gana siempre**. **Ante la duda sobre la criticidad, usar Opus.**
- **Spawnear subagentes es libre:** el orquestador lanza los que hagan falta (exploración, implementación, review) sin pedir permiso — el ruteo de esta sección decide cuál. Los subagentes siguen SIN commitear (§10).
- **Herramientas por defecto (usar siempre que corresponda, sin pedir permiso):** **Superpowers** (§9.2); **agent-skills** (§9.3, define el pipeline automático de cada mensaje); el catálogo **ECC** (§9.1); el plugin **`software-engineer`** (agents `software-engineer:developer|architect|code-reviewer|debugger|test-engineer|security-auditor|docs-writer`, skills `feature`/`ship`/`audit`); y **Ponytail** (sesgo anti-sobreingeniería, activo en cada respuesta). Se invocan según la tarea; siguen aplicando el ruteo de modelo de §9 y las reglas de commit/push de §6/§10.
- **Tauri v2 es más nuevo que el conocimiento del modelo.** Prohibido responder de memoria sobre APIs de Tauri, de sus plugins o de `tao`/`wry`. Verificar siempre contra la fuente: `v2.tauri.app`, `docs.rs/tauri`, o el código en GitHub. Las skills para esto son `ecc:documentation-lookup`, `ecc:search-first` y `agent-skills:source-driven-development`, y **no son opcionales** cuando se toca una API de Tauri que no esté ya usada en el repo.

### 9.1 Catálogo ECC (plugin `ecc@ecc`, ruteo híbrido por área)

El plugin **ECC** está instalado a nivel user (363 skills + 67 agents + 92 comandos). Política **híbrida**: el set de abajo entra al **ruteo automático** dentro de subagent-driven; **todo lo demás queda opt-in** (solo si Manu lo pide). Las skills de ECC cargan on-demand, así que la lista de auto-invocación no agrega costo always-on. **Regla de modelo:** todo agent ECC hereda el ruteo de §9 por criticidad — Sonnet por defecto, **Opus** si toca `timer.rs`, relojes, geometría de ventanas o ciclo de vida. Las reglas de ECC en `~/.claude/rules/ecc/` chocan con §6/§10 (commit/push) y **gana siempre este CLAUDE.md**.

**Agents ECC en ruteo automático:**

| Área                   | Agents                                                                     | Modelo                         |
| ---------------------- | -------------------------------------------------------------------------- | ------------------------------ |
| `area:rust-core`       | `rust-reviewer`, `silent-failure-hunter`                                   | **Opus** si toca timer/relojes |
| `area:ui` (React/TS)   | `react-reviewer`, `typescript-reviewer`, `a11y-architect`                  | Sonnet                         |
| `area:build` (Rust)    | `rust-build-resolver`                                                      | Sonnet                         |
| `area:build` (Vite/TS) | `react-build-resolver`, `build-error-resolver`                             | Sonnet                         |
| diseño/arquitectura    | `architect`, `code-architect`, `type-design-analyzer`                      | Opus                           |
| exploración            | `code-explorer`                                                            | Sonnet                         |
| testing                | `test-engineer`, `pr-test-analyzer`                                        | Sonnet                         |
| calidad general        | `code-reviewer`, `code-simplifier`, `refactor-cleaner`, `comment-analyzer` | Sonnet                         |
| docs/research          | `doc-updater`, `docs-lookup`                                               | Sonnet                         |

**Skills ECC de auto-invocación (cuando aplican):**

- Rust: `rust-patterns`, `rust-testing`, `rust-build`, `rust-review`
- Frontend: `react-patterns`, `react-performance`, `frontend-patterns`, `vite-patterns`, `frontend-a11y`, `accessibility`, `design-system`, `motion-ui`
- Calidad: `coding-standards`, `code-review`, `refactor-clean`, `test-coverage`, `quality-gate`, `verification-loop`, `repo-scan`, `code-tour`, `error-handling`
- Testing: `windows-desktop-e2e`, `react-testing`
- Research: `documentation-lookup`, `search-first` — **obligatorias** para APIs de Tauri (§9)

**Opt-in explícito (NUNCA auto — solo si Manu lo pide):** `planner` (choca con brainstorming/writing-plans de superpowers), `git-workflow` y los workflows `orch-*` / `prp-*` (commitean por su cuenta — viola §6/§10), `loop-*`, `santa-*`, y **todos los agents/skills de lenguajes y dominios fuera del stack** (nestjs, prisma, postgres, django, laravel, java, kotlin, swift, go, python, cpp, php, vue, angular, cloudflare, healthcare, defi, homelab, scientific, logistics, marketing, seo, etc.). _Nota: `tdd-guide`/`tdd-workflow` dejaron de ser opt-in — ver §7._

### 9.2 Superpowers (plugin `superpowers@superpowers-marketplace`)

Es el **flujo por defecto** para todo trabajo que no sea trivial (§10). En orden:

| Momento                                              | Skill                                                          |
| ---------------------------------------------------- | -------------------------------------------------------------- |
| Pedido ambiguo, con alternativas o de diseño abierto | `superpowers:brainstorming` — **antes** de planificar          |
| Spec / issue / trabajo multi-paso                    | `superpowers:writing-plans` → plan a `docs/plans/`             |
| Escribir la lógica                                   | `superpowers:test-driven-development` — **canónico** (§7)      |
| Ejecutar ese plan                                    | `superpowers:subagent-driven-development` (ruteo de modelo §9) |
| Bug con causa no obvia                               | `superpowers:systematic-debugging`                             |
| Antes de dar algo por terminado                      | `superpowers:verification-before-completion`                   |
| Review del working tree                              | `superpowers:requesting-code-review` / `receiving-code-review` |

**No usar:** `finishing-a-development-branch` ni `using-git-worktrees` — commitean/mergean por su cuenta y violan §6/§10.

**Choque con este CLAUDE.md:** cualquier paso de una skill de superpowers que commitee, pushee o abra un PR se **omite**. Gana siempre §6/§10 — el trabajo queda en el working tree.

**Ubicación de artefactos:** `brainstorming` guarda por default en `docs/superpowers/specs/`. **Acá va a `docs/specs/`** (specs) y `docs/plans/` (planes); el diseño de arquitectura vive en `docs/architecture.md`. La skill acepta el override explícito del proyecto.

### 9.3 agent-skills (plugin `agent-skills@addy-agent-skills`) — el pipeline automático de cada mensaje

24 skills + 4 personas + 8 slash commands que cubren el ciclo completo (define → plan → build → verify → review → ship). **Manu NO escribe comandos.** Los `/spec`, `/plan`, `/build`, `/test`, `/review`, `/ship`, `/code-simplify` son atajos manuales; el modo normal es que **el agente corra este pipeline solo**, apenas Manu escribe el pedido.

**Paso 0 — encuadrar antes de correr nada.** Clasificar el pedido: pregunta / cambio trivial (un archivo, fix puntual, config) → responder o hacerlo directo y terminar (§10, último bullet). Bug → entrar por Verificar. Feature o trabajo multi-paso → pipeline completo desde Definir. Correr spec+plan+ship por un ajuste de una línea es exactamente lo que Ponytail prohíbe.

| Fase            | Se dispara cuando                          | Qué corre (en este orden)                                                                                                                                                                                                                                                                                                                                                    | Artefacto                        |
| --------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **Definir**     | el pedido es ambiguo o abre alternativas   | `superpowers:brainstorming` (canónico). `agent-skills:interview-me` **solo** si Manu pide que lo interroguen                                                                                                                                                                                                                                                                  | `docs/architecture.md`           |
| **Especificar** | etapa nueva o Issue sin criterios claros   | `agent-skills:spec-driven-development` (objetivo, comandos, estructura, estilo, testing, límites) — **canónico** (§7)                                                                                                                                                                                                                                                         | `docs/specs/SPEC-<module-id>.md` |
| **Planificar**  | spec/issue/trabajo multi-paso              | `superpowers:writing-plans` con el estándar de `agent-skills:planning-and-task-breakdown` (slices **verticales**, criterios de aceptación por tarea, orden por dependencias)                                                                                                                                                                                                  | `docs/plans/`                    |
| **Construir**   | hay plan aprobado (o el OK de §10.0)       | `superpowers:test-driven-development` **primero** (§7), después `superpowers:subagent-driven-development` (+ agrupación por archivo de §10.2) con la disciplina de `agent-skills:incremental-implementation`. Por área se suman: `frontend-ui-engineering` (React/Tailwind), `source-driven-development` (**obligatoria** para APIs de Tauri, §9), `context-engineering` (sesión larga) | código en el working tree        |
| **Verificar**   | test roto, build roto, comportamiento raro | `superpowers:systematic-debugging` primero; `agent-skills:debugging-and-error-recovery` como checklist de triage (reproducir → localizar → reducir → arreglar → blindar). Cierre: los cinco comandos de §7, **una sola vez** (§10.2)                                                                                                                                           | test que reproduce + suite verde |
| **Revisar**     | al cerrar cada etapa, no por tarea (§10.2) | `agent-skills:code-review-and-quality` (5 ejes: correctitud, legibilidad, arquitectura, seguridad, performance) + el reviewer ECC del área (§9.1). Si sobra complejidad: `agent-skills:code-simplification`, con Ponytail como criterio final                                                                                                                                  | hallazgos Critical/Important/Nit |
| **Cerrar**      | antes de decir "listo" (nunca commitea)    | fan-out de `/ship`: los subagentes **en paralelo en un solo turno** — `agent-skills:code-reviewer` y `agent-skills:test-engineer` — y sintetizar **GO / NO-GO**. `security-auditor` solo si se agregó una dependencia o una llamada saliente (§2)                                                                                                                              | veredicto + instrucciones de §7  |

**Cuándo se saltea el fan-out de Cierre:** ≤2 archivos **y** <50 líneas **y** que no toque `timer.rs`, geometría de ventanas, persistencia ni dependencias. Si toca cualquiera de esas, va el fan-out aunque el diff sea chico.

**Choques con este CLAUDE.md (gana siempre este archivo):**

- **Cero git.** `git-workflow-and-versioning`, `shipping-and-launch` y sobre todo `/build auto` (que commitea por tarea) traen pasos de commit/push/PR: se ejecuta la parte de implementación y verificación y se **omite todo paso de git**. El trabajo queda en el working tree hasta que Manu autorice (§6, §10).
- **No se para a preguntar.** Las "Core Operating Behaviors" del pack mandan a frenar ante cualquier confusión. Acá gana §10.0: los supuestos se **anotan en el reporte final**, y solo se frena por las tres preguntas críticas de §10.0 — más la parada obligatoria de fin de etapa (§7) y el aviso previo a agregar dependencias (§5).
- **Artefactos donde van.** Specs a `docs/specs/`, planes a `docs/plans/`. **Prohibido** crear `SPEC.md`, `tasks/plan.md` o `tasks/todo.md` en la raíz, que es lo que los comandos del pack piden por default.
- **Una sola review, no tres.** El pack, ECC y `software-engineer` tienen revisores que se pisan. Orden: los 5 ejes de agent-skills primero; el reviewer ECC del área solo si el área lo pide (§9.1); `software-engineer:code-reviewer` solo si Manu lo nombra.
- **Ponytail arbitra el volumen.** Si el pack pide más estructura de la que el cambio justifica (ADR, spec formal, instrumentación, checklist de launch), se saltea y se anota en una línea.

## 10. Flujo de Ejecución por Defecto

- **Decisiones menores** (nombres de variables, valores por defecto, approach entre opciones equivalentes): elegir una opción razonable y seguir, dejándola anotada. Parar a preguntar **solo** ante cambios de scope o acciones destructivas/irreversibles.
- **Specs / issues / trabajo multi-paso**: presentar un **plan antes de tocar código** y ejecutar **subagent-driven** con checkpoint entre tareas (ruteo de modelo según §9). El pipeline concreto —qué skill corre en cada fase, sin que Manu escriba ningún comando— está en **§9.3**.
- **Subagent-driven SIEMPRE sin commits (regla fija):** al ejecutar con el flujo subagent-driven, los subagentes (y el orquestador) **NUNCA commitean** — ni por tarea ni al final. Todo queda en el **working tree**; las review por tarea se hacen sobre el **diff del working tree** (`git diff` + archivos sin trackear), no sobre commits `BASE..HEAD`. El commit lo hace Manu cuando él lo decide (§6). Esto anula el commit-por-tarea que el método subagent-driven trae por defecto.
- **Cambios triviales** (un solo archivo, fix puntual, ajuste de config): ir directo, sin plan formal ni subagentes.

### 10.0 Dado el OK, se trabaja de corrido

Cuando Manu da el visto bueno para arrancar ("dale", "hacelo", "mandale", "procedé"), el agente **ejecuta de punta a punta sin interrupciones**: no pide permiso, no pide confirmación entre tareas, no ofrece opciones para que elija, no pregunta "¿sigo?". El OK cubre todo el trabajo, no el primer paso.

- **Las decisiones de implementación las toma el agente**, y el criterio es: **lo más simple que resuelva el pedido bien** (Ponytail). Ante dos opciones equivalentes, gana la que cierra más superficie de error. La decisión se anota (comentario o reporte final), no se consulta.
- **Se pausa SOLO por preguntas críticas**, y son tres: (1) una acción destructiva o irreversible que el pedido no implicaba; (2) una ambigüedad donde elegir mal invalida **todo** el trabajo, no una parte; (3) información que solo Manu tiene y no está en el repo. Todo lo demás se decide y se sigue.
- **Más dos paradas fijas que no son "preguntas":** el fin de cada etapa (§7) y el aviso previo a agregar una dependencia (§5).
- **Cambio de scope**: si aparece trabajo necesario fuera de lo pedido, se hace lo pedido completo y se **reporta** lo otro al final. No se para a preguntar, y tampoco se amplía el scope por cuenta propia.
- **Un hallazgo mientras se trabaja no es una interrupción**: se arregla si entra en el scope, se anota si no.

**Lo único que sigue estando gateado es git.** §6 no se toca: `commit`, `push` y abrir un PR siguen necesitando el OK explícito de Manu. "Trabajar sin pedir permiso" significa escribir código sin checkpoints, no commitear solo.

### 10.1 Cómo se escriben los comandos de shell (aplica al orquestador y a TODO subagente)

Cuatro reglas, y las cuatro existen por el mismo motivo: en Windows + Git Bash hay comandos que el analizador de permisos **no puede escanear**, y entonces se mandan a aprobación manual del usuario en vez de resolverse solas. No es un problema de permisos: es la forma del comando.

- **Escribir archivos con la herramienta Write/Edit, NUNCA con `cat > archivo << 'EOF'` ni `echo ... >> archivo`.** Un heredoc largo supera el largo máximo analizable (`Command exceeds the maximum analyzable length`) y dispara revisión humana. Write se autoacepta en modo auto.
- **No prefijar los comandos con `cd <ruta> && ...`.** El cwd de la sesión ya es la raíz del repo. Con un compound que empieza en `cd`, el analizador no puede determinar estáticamente el directorio final (`the final working directory of this cd-compound cannot be statically determined`) y no delega al clasificador. Para Cargo, usar `--manifest-path src-tauri/Cargo.toml` en vez de `cd src-tauri`.
- **Comandos cortos y de una intención.** Encadenar cinco cosas con `&&` para ahorrar una llamada termina costando un prompt de permiso, que cuesta más.
- **Sin llaves `{ … }` ni variables de shell** (`ws=/ruta; ... > "$ws/x.diff"`) en comandos que escriban archivos: el analizador lo clasifica como ofuscación de expansión y también manda a aprobación manual. Rutas absolutas literales, siempre.

**El orquestador DEBE pegar estas cuatro reglas en el prompt de CADA subagente que despache — incluidos los revisores y auditores read-only.** Un subagente no hereda esta sección: si no se la pasás, escribe `cd … && awk … && diff …` y dispara el prompt de permiso igual. El error típico es acordarse de ponerlas en los prompts de implementación y olvidarlas en los de revisión, que son la mayoría de los despachos.

**No agregar reglas de `permissions` (`allow`/`ask`/`deny`) para "reducir prompts": lo empeora.** Una regla `ask` **pisa al clasificador del modo auto**, así que un patrón amplio como `Bash(rm *)` convierte en pregunta todo lo que antes se aprobaba solo. El clasificador distingue un `rm` dentro del repo de un `rm -rf /`; un patrón por prefijo no. Si igual hacen falta reglas, van a `.claude/settings.local.json` (gitignoreado) y **nunca** a `.claude/settings.json`, que está commiteado.

### 10.2 Cómo se ejecuta subagent-driven sin que tarde tres horas

- **Agrupar las tareas por archivo, no por concepto.** Si dos tareas del plan tocan los mismos archivos, son **una** tarea. Un ciclo implementar→revisar cuesta el costo fijo de que un subagente nuevo relea su brief, explore el archivo y corra la suite. Partir solo donde un revisor podría razonablemente aprobar una y rechazar la otra.
- **El §9 rutea por criticidad, pero un plan con el código literal adentro es transcripción.** Cuando el plan ya trae el bloque a escribir, el trabajo del implementador es transcribir y testear, no diseñar: va en **Sonnet** aunque el archivo sea `timer.rs`. Opus se reserva para las tareas donde el plan describe _qué_ hacer y no _cómo_, y para las reviews de lógica de relojes y ventanas.
- **La verificación por tarea es acotada; la completa va al final.** Cada tarea corre **el test puntual que tocó**, no la suite entera, ni typecheck, ni clippy. Los cinco comandos de §7 se corren **una vez**, en la última tarea.
- **Una review por etapa, no por tarea.** Los hallazgos Minor **no** abren rondas de fix: van a un ledger y los triage la review final de la etapa.
- **Paralelizar lo que no comparte archivos.** Una review y el implementador de la tarea siguiente pueden correr juntos si tocan archivos distintos. Si comparten archivo, serializar. Nunca dos implementadores en paralelo.

Regla de oro: **el costo no está en los tokens, está en la cantidad de turnos en serie.** Antes de despachar, preguntarse si este subagente puede compartir viaje con el anterior.

## 11. Trampas conocidas de Tauri v2 en Windows

Verificadas contra el código fuente, no de memoria. Si alguna resulta falsa, corregir **acá** además de en el código.

- **No existe `set_transparent`.** La transparencia es un atributo de **creación** de la ventana: `tao` instala la región DWM y setea `WindowFlags::TRANSPARENT` al crear el `HWND`. Es la razón por la que Cairn tiene tres ventanas y no una reconfigurada.
- **`set_focus()` es un no-op si la ventana está oculta o minimizada.** El `set_focus` de `tao` arranca con `if is_visible && !is_minimized && !is_foreground`. El orden correcto es SIEMPRE `show()` → `unminimize()` → `set_focus()`. Es el bug clásico de "no me trae la ventana al frente".
- **No hace falta escribir Win32 para robar el foco.** Windows bloquea `SetForegroundWindow` desde procesos que no son el de primer plano, pero `tao` ya trae el workaround (simula un ALT izquierdo con `SendInput` y reintenta). Usar `set_focus()` y listo — nada de `unsafe` (§5).
- **`tauri-plugin-single-instance` debe registrarse PRIMERO**, antes que cualquier otro plugin. Está documentado y falla en silencio si no.
- **Sin `prevent_exit()` la app muere al ocultar la última ventana** y la bandeja queda huérfana. `RunEvent::ExitRequested` → `api.prevent_exit()`.
- **La geometría de monitores es en píxeles FÍSICOS.** `Monitor::position()`/`size()` son físicos; `scale_factor()` viene aparte. Con `LogicalSize`, Tauri multiplica por la escala **de la ventana en ese momento**, que puede no ser la del monitor destino todavía. Usar `PhysicalPosition`/`PhysicalSize` y multiplicar a mano lo que deba medirse en píxeles visuales.
- **`data-tauri-drag-region` pelado solo funciona si el click cae EXACTAMENTE sobre ese elemento.** El script de Tauri (`window/scripts/drag.js`) resuelve el atributo sin valor como `el === composedPath[0]`, así que en una pantalla cubierta por hijos —un encabezado, un contador, una fila de botones— arrastrar y el **doble click para maximizar** solo andan en los huecos vacíos. Para que valga todo el subárbol hay que escribir `data-tauri-drag-region="deep"`. Los controles no pelean con el arrastre: Tauri excluye `A`, `BUTTON`, `INPUT`, `SELECT`, `TEXTAREA`, `LABEL` y `SUMMARY`, más cualquier elemento con `role` interactivo o `tabindex`. Y el doble click invoca `internal_toggle_maximize`, que **no hace nada si la ventana tiene `maximizable: false`**.
- **WebView2 estrangula los timers de JS en ventanas ocultas.** Ninguna lógica que tenga que ocurrir a tiempo puede vivir en un `setInterval` del frontend.
- **Los comandos `core:*` y los de plugins necesitan permiso declarado en `src-tauri/capabilities/`; los comandos propios de la app NO.** Una _capability_ es el archivo JSON que le dice a Tauri qué puede invocar cada ventana, y el ACL solo cubre `core:*` y plugins. Los comandos propios registrados con `invoke_handler`/`generate_handler!` están permitidos por defecto para todas las ventanas — textual de [v2.tauri.app/security/capabilities](https://v2.tauri.app/security/capabilities/): _"By default, all commands that you registered in your app (using the `tauri::Builder::invoke_handler` function) are allowed to be used by all the windows and webviews of the app."_ (Verificado el 2026-09-02 contra Tauri 2.11.5; la versión previa de esta línea decía "todo comando" y era falsa.) Cuando falta un permiso de plugin, la llamada falla **en runtime**, no en compilación, y el error aparece en la consola del webview, no en la terminal de `cargo`. Sigue siendo la primera cosa a revisar cuando un `invoke` a un plugin "no hace nada" — pero si el `invoke` es a un comando propio, el problema es otro.

## graphify

Si existe `graphify-out/graph.json`, para preguntas sobre el código correr primero `graphify query "<pregunta>"` (y `graphify path "<A>" "<B>"` / `graphify explain "<concepto>"`): devuelven un subgrafo acotado, mucho más chico que `GRAPH_REPORT.md` o un grep crudo. Después de modificar código, `graphify update .` (solo AST, sin costo de API). Hoy el repo **no** tiene grafo generado; esta sección se activa sola cuando lo tenga.

# Guidelines

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
