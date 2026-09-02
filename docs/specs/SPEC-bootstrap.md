# SPEC: `bootstrap` — Etapa 1

Padre: [`CAPABILITY-MAP.md`](CAPABILITY-MAP.md) · Depende de: — · Label: `stage:1-bootstrap`

## Objetivo

Un proyecto Tauri v2 que arranca, muestra un hola mundo con Tailwind aplicado,
y produce un `.exe` que se puede doble-clickear. Nada más. El objetivo real es
**probar la cadena de herramientas completa antes de escribir lógica**: si el
toolchain de Rust falla, que falle en la primera línea y no en la número mil.

## Prerrequisito bloqueante (lo instala Manu, el agente no puede)

Verificado el 2026-09-02: en esta máquina **falta todo el toolchain de Rust**.

| Requisito            | Estado                     | Cómo se instala                                                           |
| -------------------- | -------------------------- | ------------------------------------------------------------------------- |
| WebView2 Runtime     | ✅ 151.0.4129.107          | ya está                                                                   |
| Rust (`rustup`)      | ❌ no existe `~/.cargo`    | https://rustup.rs → toolchain `stable-x86_64-pc-windows-msvc`             |
| MSVC C++ Build Tools | ❌ no está el VS Installer | Visual Studio Build Tools → carga "Desarrollo para el escritorio con C++" |

Sin esos dos, `pnpm tauri dev` no compila. Tauri linkea con el linker de MSVC,
así que el target `-gnu` **no** es un atajo válido.

Verificación: `rustc -V` y `cargo -V` responden en una terminal nueva.

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
