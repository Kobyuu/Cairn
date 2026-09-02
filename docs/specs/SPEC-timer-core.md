# SPEC: `timer-core` — Etapa 2

Padre: [`CAPABILITY-MAP.md`](CAPABILITY-MAP.md) · Depende de: `bootstrap` · Label: `stage:2-timer`

## Objetivo

El ciclo completo funcionando con UI fea: cuenta, vence, confirmo, reinicia, más
posponer. **Es el corazón del proyecto y la única parte donde un bug es
invisible** — un temporizador que deriva de a poco no se nota hasta que ya te
falló diez veces. Por eso la máquina de estados es aritmética pura y testeada al
detalle antes de que exista una sola ventana linda.

## Diseño (canónico: `docs/architecture.md` §D1–D3)

```rust
pub enum Phase {
    Idle,
    Running  { deadline_ms: u64 },   // instante de vencimiento, epoch Unix ms
    Paused   { remaining_ms: u64 },
    Elapsed  { since_ms: u64 },      // arranca el cronómetro ascendente
}
```

Tres decisiones que no se negocian:

1. **Hora de pared, no `Instant`.** `deadline_ms` es epoch Unix en ms. `Instant`
   en Windows es `QueryPerformanceCounter` y no avanza durante la suspensión.
2. **El "ahora" se inyecta.** Toda transición vive en funciones puras
   `fn(phase, interval_ms, now_ms) -> Phase`. El hilo de 1 Hz solo le pasa
   `SystemTime::now()`. Así se testea el vencimiento sin esperar 45 minutos.
3. **Rust emite transiciones, no el countdown.** El frontend deriva el restante
   con `deadline_ms - Date.now()`. Sin IPC por segundo, y sin acumulación de
   error porque no hay acumulación.

### Conflicto resuelto con el handoff de diseño

`docs/design_handoff_cairn/README.md` §State Management propone
`cycleStartedAt` y define posponer como `cycleStartedAt = now - (interval - n)`.
**No se implementa así.** Es un rodeo para reusar un solo campo; con
`deadline_ms` posponer es `deadline = now + n`, sin resta inversa ni riesgo de
signo. El handoff es fuente de verdad **visual y de animación**, no de
arquitectura de estado — ahí gana CLAUDE.md §2 y `architecture.md` §D2.
Equivalencia para leer el handoff: `deadline_ms == cycleStartedAt + interval`.

## Criterios de aceptación

1. Arranca en `Running` con 45 min por defecto; el intervalo se puede cambiar.
2. Play, pausa y reiniciar funcionan y se reflejan en la UI al instante.
3. Al vencer, pasa a `Elapsed` y **se queda ahí**. No se reinicia solo.
4. En `Elapsed` corre un cronómetro **ascendente** desde `since_ms`, en `mm:ss`.
5. "Listo" reinicia el ciclo con el intervalo configurado.
6. Posponer rápido (5 min por defecto) y posponer N minutos arbitrarios.
7. Suspender y despertar se comporta según D3: dormido **más** de un intervalo →
   reinicio silencioso; **menos** → `Elapsed` con el atraso real, contando desde
   `deadline_ms`, no desde el despertar.
8. Un reloj que salta para atrás no deja un restante mayor que el **ciclo en
   curso** (que es el intervalo, salvo que se haya pospuesto — ver `architecture.md` §D2).

## Tests (TDD — se escriben ANTES del código)

`cargo test` sobre `src-tauri/src/timer.rs`. Ninguno duerme el hilo.

| Test                              | Entrada                                             | Esperado                             |
| --------------------------------- | --------------------------------------------------- | ------------------------------------ |
| `running_before_deadline`         | `now = deadline - 1`                                | sigue `Running`, sin cambio          |
| `expires_at_exact_deadline`       | `now == deadline`                                   | `Elapsed { since_ms: deadline }`     |
| `wake_slightly_overdue`           | `now = deadline + interval/2`                       | `Elapsed { since_ms: deadline }`     |
| `wake_long_overdue_resets_silent` | `now = deadline + interval + 1`                     | `Running { deadline: now+interval }` |
| `pause_freezes_remaining`         | `Running`, pausa en `now`                           | `Paused { remaining: deadline-now }` |
| `resume_rebases_deadline`         | `Paused{rem}`, reanuda en `now`                     | `Running { deadline: now+rem }`      |
| `snooze_extends_from_now`         | `Elapsed`, posponer 5 min en `now`                  | `Running { deadline: now+5min }`     |
| `snooze_arbitrary_minutes`        | posponer 17 min                                     | `Running { deadline: now+17min }`    |
| `done_restarts_full_interval`     | `Elapsed`, "Listo" en `now`                         | `Running { deadline: now+interval }` |
| `clock_jump_back_clamps`          | `Running`, `now` retrocede tal que `rem > interval` | restante recortado a `interval`      |

`vitest` sobre el frontend: `remainingMs` nunca negativo; el formateo de `00:00`,
`44:59` y `1:00:00` sale exacto; el cronómetro ascendente crece.

**Disciplina:** cada fila se escribe y se ve **roja** antes de implementar la
rama que la satisface.

## Verificación manual

- [ ] Intervalo en 1 minuto: vence y **no** se reinicia solo.
- [ ] "Listo" reinicia; el contador vuelve al intervalo completo.
- [ ] Posponer 5 min y posponer 2 min a mano, ambos corren.
- [ ] Pausar, esperar 30 s, reanudar: el restante es el de antes de pausar.
- [ ] Intervalo en 2 min, suspender la PC 10 min, despertar → reinicio
      silencioso, sin aviso (D3, rama larga).
- [ ] Intervalo en 45 min, suspender hasta 3 min pasado el vencimiento,
      despertar → aviso con el atraso real (D3, rama corta).

## Límites

- **Nunca:** `setInterval` que acumule segundos, ni `Instant` para el deadline.
- **Nunca:** reinicio automático al vencer.
- **No todavía:** la notificación del sistema es etapa 3 y la conmutación a Foco
  es etapa 4. Acá el vencimiento se ve en la UI fea y alcanza.
- **Preguntar primero:** cualquier crate nuevo. La stdlib alcanza — sin `chrono`.

## Preguntas abiertas

Ninguna. D3 quedó decidido por Manu el 2026-09-02.
