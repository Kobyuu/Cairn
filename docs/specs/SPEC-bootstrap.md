# SPEC: `bootstrap` — Etapa 1

Padre: [`CAPABILITY-MAP.md`](CAPABILITY-MAP.md) · Depende de: — · Label: `stage:1-bootstrap`

## Objetivo

Un proyecto Tauri v2 que arranca, muestra un hola mundo con Tailwind aplicado,
y produce un `.exe` que se puede doble-clickear. Nada más. El objetivo real es
**probar la cadena de herramientas completa antes de escribir lógica**: si el
toolchain de Rust falla, que falle en la primera línea y no en la número mil.

## Prerrequisitos — RESUELTOS el 2026-09-02

| Requisito            | Estado                                                             |
| -------------------- | ------------------------------------------------------------------ |
| WebView2 Runtime     | ✅ 151.0.4129.107                                                  |
| Rust                 | ✅ 1.98.0, toolchain `stable-x86_64-pc-windows-msvc`, con clippy y rustfmt |
| MSVC C++ Build Tools | ✅ 17.14, en `D:\VS\BuildTools` — MSVC 14.44.35207 + Windows 11 SDK |

Verificado de punta a punta: `cargo new` + `cargo build` produjeron un `.exe` que
corre. No alcanza con que exista `link.exe`; la prueba es que linkee.

**Dos cosas que quedaron aprendidas y conviene no repetir:**

- **Build Tools está instalado en `D:`, no en `C:`.** `C:` tenía 6 GB libres y una
  instalación con `--includeRecommended` pide entre 5 y 7. El comando que
  funcionó fue el bootstrapper oficial (`aka.ms/vs/17/release/vs_BuildTools.exe`)
  con `--installPath D:\VS\BuildTools` y **solo dos componentes**:
  `Microsoft.VisualStudio.Component.VC.Tools.x86.x64` y
  `Microsoft.VisualStudio.Component.Windows11SDK.26100`. Total: 1,67 GB.
- **winget quedó creyendo que Build Tools sigue instalado** de un intento previo
  que se canceló. Si hace falta reinstalar, ir directo al bootstrapper — winget
  responde "No available upgrade found" y no hace nada.

Tauri linkea con el linker de MSVC, así que el target `-gnu` **no** es un atajo
válido si algo de esto se rompe.

## Alcance

- `pnpm create tauri-app` con React + TypeScript, o scaffolding equivalente.
- Tailwind v4 vía `@tailwindcss/vite` (sin `postcss.config.js`).
- **Una sola ventana** en `tauri.conf.json`. Los tres modos son etapa 4; meterlos
  acá es exactamente el error que la etapa 1 existe para evitar.
- ESLint + `@typescript-eslint`, `tsc --noEmit`, `vitest`, `cargo clippy` y
  `cargo fmt` configurados y en verde con cero código propio.
- `.gitignore` con `node_modules/`, `dist/`, `src-tauri/target/`.

## Criterios de aceptación

1. `pnpm install` termina sin errores.
2. `pnpm tauri dev` abre una ventana con texto visible y estilo de Tailwind
   aplicado (no el default del navegador).
3. `pnpm tauri build` produce un ejecutable en `src-tauri/target/release/` que
   arranca al doble-clickearlo, con el IDE cerrado.
4. Los cinco comandos de verificación en verde.
5. El identificador de la app en `tauri.conf.json` **no** es el default
   `com.tauri.dev`: Windows lo usa para las notificaciones de la etapa 3, y con
   el default fallan sin decir por qué.

## Tests (TDD)

Esta etapa es configuración, no lógica: no hay nada que testear con TDD y
forzarlo sería teatro. Se agrega **un** test trivial por runner, cuyo único
trabajo es demostrar que el runner corre y falla cuando debe:

- `src/smoke.test.ts` — un `expect(1 + 1).toBe(2)` en vitest.
- `src-tauri/src/lib.rs` — un `#[test]` equivalente en `cargo test`.

Verificar que ambos **fallan** al romperlos a propósito, antes de darlos por
buenos. Un runner que reporta verde sin ejecutar nada es peor que ninguno.

## Verificación manual

- [ ] `pnpm tauri dev` abre la ventana en ~10 s o menos en la segunda corrida.
- [ ] El texto se ve con la tipografía y el color de Tailwind, no Times New Roman.
- [ ] Cerrar la ventana termina el proceso — todavía **no** hay bandeja (etapa 3),
      así que acá cerrar sí debe cerrar.
- [ ] El `.exe` de `release` arranca con el IDE cerrado.

## Límites

- **Nunca:** plugins de Tauri en esta etapa. Store, notification, single-instance
  y autostart son etapa 3.
- **Nunca:** tres ventanas, bandeja, ni lógica de temporizador.
- **Preguntar primero:** cualquier dependencia más allá de las que traen de
  fábrica el template de Tauri y Tailwind.

## Preguntas abiertas

Ninguna. El bloqueo es de instalación, no de diseño.
