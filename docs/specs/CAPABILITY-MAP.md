# Capability Map: Cairn

Índice de qué existe y en qué orden se construye. Las specs por módulo se
seleccionan por **module id**, no adivinando nombres de archivo.

| Module id            | Responsabilidad                                                          | Depende de           | Etapa |
| -------------------- | ------------------------------------------------------------------------ | -------------------- | ----- |
| `bootstrap`          | Proyecto que compila: Tauri v2 + React + TS + Vite + Tailwind, un `.exe` | —                    | 1     |
| `timer-core`         | Máquina de estados del temporizador en Rust + UI mínima                  | `bootstrap`          | 2     |
| `system-integration` | Bandeja, instancia única, ajustes persistidos, autostart                 | `timer-core`         | 3     |
| `presence-modes`     | Foco, Widget, Ambiente y la conmutación entre ellos                      | `system-integration` | 4     |
| `routine`            | Rutina en markdown: leer, renderizar, editar, guardar                    | `presence-modes`     | 5     |
| `visual-design`      | Handoff de Claude Design aplicado a las tres vistas                      | `routine`            | 6     |

**Orden de construcción:** `bootstrap` → `timer-core` → `system-integration` → `presence-modes` → `routine` → `visual-design`

Estrictamente lineal, sin paralelismo, por decisión de Manu: cada etapa termina
en una parada donde él prueba antes de seguir (CLAUDE.md §7).

**Dependencias, una línea cada una.** `timer-core` necesita un proyecto que
compile. `system-integration` necesita un temporizador que pausar desde la
bandeja y ajustes que persistir. `presence-modes` necesita que los ajustes
guarden el modo y la posición del widget. `routine` se renderiza dentro de la
pantalla de Foco. `visual-design` repinta lo que ya funciona.

---

# Áreas núcleo compartidas

Valen para **todas** las specs. Cada `SPEC-<module-id>.md` declara solo su
delta: objetivo, criterios de aceptación, tests y límites. Repetir el stack
seis veces es cómo se pudren las specs.

## 1. Objetivo global

Cairn avisa cada N minutos (45 por defecto) que es hora de una pausa, y el
ciclo **se reinicia solo cuando el usuario confirma que terminó**. El intervalo
es configurable, así que sirve igual como pomodoro o como cronómetro de
cualquier otra cosa. Usuario: Manu, en su PC con Windows. Éxito: usarla todos
los días sin pelearse con ella.

## 2. Comandos

```
Instalar:   pnpm install
Desarrollo: pnpm tauri dev
Build:      pnpm tauri build          → src-tauri/target/release/
Lint TS:    pnpm lint                 (eslint --max-warnings 0)
Types:      pnpm typecheck            (tsc --noEmit)
Test TS:    pnpm test                 (vitest run)
Lint Rust:  cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
Test Rust:  cargo test --manifest-path src-tauri/Cargo.toml
```

Los cinco de verificación (`lint`, `typecheck`, `test`, `clippy`, `cargo test`)
tienen que estar en verde antes de cerrar cualquier etapa.

## 3. Estructura del proyecto

```
src/                    → frontend React; un bundle para las tres ventanas
src/views/              → Foco.tsx, Widget.tsx, Ambient.tsx, Settings.tsx
src/*.test.ts           → tests de vitest, al lado del archivo que prueban
src-tauri/src/          → core de Rust (lib, timer, modes, settings, routine)
src-tauri/capabilities/ → permisos de Tauri v2 (qué puede invocar cada ventana)
docs/specs/             → estas specs
docs/plans/             → planes de ejecución por etapa
docs/architecture.md    → las decisiones D1..D9 y su porqué
```

## 4. Estilo de código

Rust — `enum` con datos en vez de flags sueltos, y el "ahora" **inyectado**
para que la lógica sea testeable sin dormir el hilo:

```rust
/// Devuelve el estado que corresponde a `now_ms`, sin tocar el reloj real.
/// `now_ms` se inyecta para poder testear el vencimiento y el despertar de
/// la suspensión sin esperar 45 minutos.
pub fn advance(phase: Phase, interval_ms: u64, now_ms: u64) -> Phase {
    match phase {
        Phase::Running { deadline_ms } if now_ms >= deadline_ms => {
            // Dormido más de un ciclo entero: eso ya fue una pausa (D3).
            if now_ms - deadline_ms > interval_ms {
                Phase::Running { deadline_ms: now_ms + interval_ms }
            } else {
                Phase::Elapsed { since_ms: deadline_ms }
            }
        }
        other => other,
    }
}
```

TypeScript — el restante se deriva del deadline, nunca se acumula:

```ts
const remainingMs = Math.max(0, deadlineMs - Date.now());
```

Convenciones: código en inglés, comentarios largos en español. Sin `any`, sin
`unwrap()` fuera de tests, sin `unsafe`.

## 5. Estrategia de testing

- **`cargo test` sobre `timer.rs` es la suite que importa.** Aritmética pura
  sobre `u64`, con el `now_ms` inyectado. Ningún test duerme el hilo.
- **`vitest`** para la derivación y el formateo en el frontend.
- **Verificación manual con checklist** para ventanas, bandeja, DPI y foco: no
  hay test automático razonable para "la franja quedó de 4px al 150%". Cada
  spec trae su checklist.
- **TDD obligatorio** (CLAUDE.md §7): el test que falla va antes del código. En
  bugs, el test que reproduce va antes del fix.
- Cobertura: no hay número mínimo. La regla es que cada criterio de aceptación
  tenga un test o un ítem de checklist que lo pruebe.

## 6. Límites

**Siempre:**

- Correr los cinco comandos antes de cerrar una etapa.
- Entregar la checklist de verificación manual al final de cada etapa y frenar.
- Derivar el tiempo de un deadline en hora de pared, nunca acumular.
- Declarar los permisos en `src-tauri/capabilities/` al agregar un comando.

**Preguntar primero:**

- Agregar **cualquier** dependencia, de Rust o de JS (CLAUDE.md §5).
- Commit, push o abrir un PR (CLAUDE.md §6).
- Usar `unsafe` o llamar a Win32 directo.
- Cambiar una decisión de `docs/architecture.md`.

**Nunca:**

- Reiniciar el ciclo automáticamente al vencer.
- Reiniciar la cuenta al cambiar de modo.
- Guardar la rutina como cadena dentro de `store.json`.
- Agregar red, telemetría o backend.
- Escribir código para macOS o Linux.
