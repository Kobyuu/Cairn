# Plan de ejecución — Etapa 4 · `presence-modes`

Spec: [`SPEC-presence-modes.md`](../specs/SPEC-presence-modes.md) · Arquitectura: D4–D6

## Decisiones tomadas antes de escribir código

1. **Las tres ventanas se declaran en `tauri.conf.json`, no se crean a mano.**
   `transparent`, `decorations`, `shadow`, `skipTaskbar`, `focus` y `resizable`
   son atributos de **creación** del `HWND` (D4): el lugar natural es la config.
   Lo que sí va en Rust es la geometría, que depende del monitor y no se puede
   escribir en un archivo estático.

2. **`cycle_ms` pasa a viajar al frontend, y sobrevive a la pausa.** Ambiente y
   el widget pintan el **porcentaje de ciclo transcurrido**, y eso no se puede
   derivar del intervalo nominal: posponer 5 min con un intervalo de 45 tiene
   que llenar la barra en 5 minutos, no en 45.

   Consecuencia sobre `resume`: hasta ahora el ciclo reanudado se quedaba con
   `cycle_ms = remaining_ms`. Con la barra dibujada eso significa que pausar al
   48 % y reanudar devolvía la barra a 0 %. Ahora `Paused` lleva el largo
   nominal del ciclo y `resume` lo conserva. El clamp anti-salto-de-reloj sigue
   siendo válido (el restante nunca supera el ciclo); queda un pelo más flojo,
   y ese aflojamiento es el precio de que la barra no mienta.

3. **El modo elegido y la ventana visible son dos cosas distintas.** `mode` es
   lo que eligió el usuario; la ventana visible se **deriva**:
   `Elapsed → siempre Foco`, cualquier otra fase → la ventana del modo. Así
   "al vencer aparece Foco, al confirmar vuelve a Ambiente" sale gratis y sin
   recordar nada extra, y un vencimiento no pisa la preferencia guardada.

4. **La conmutación se engancha en `announce()`**, que ya es el punto único por
   el que sale cualquier cambio de estado hacia las vistas y la bandeja. Una
   cuarta cosa que sincronizar en el mismo lugar, no un canal nuevo.

5. **La posición del widget se captura al ocultarlo y al salir, no en `Moved`.**
   `Moved` dispara decenas de veces por segundo durante un arrastre y cada una
   sería una escritura de `store.json` a disco. Se le pregunta la posición a la
   ventana en los dos momentos en que puede haber cambiado y no vamos a poder
   preguntar después.

6. **La geometría de Ambiente se re-chequea a 1 Hz, aprovechando el ticker que
   ya existe.** Tauri no expone un evento de "cambió la configuración de
   pantallas"; la checklist de la spec pide desconectar y reconectar un monitor.
   Comparar el rectángulo calculado contra el último aplicado y reposicionar
   solo si cambió cuesta ~10 líneas y cubre además el cambio de resolución y de
   escala. Solo corre cuando Ambiente es el modo activo.

7. **`window.primary_monitor()`, nunca `app.primary_monitor()`.** El del
   `AppHandle` toca `window_target` directo, y su propio comentario de
   seguridad en `tauri-runtime-wry` dice que ese campo es solo del hilo
   principal; el de la ventana manda un mensaje al hilo principal y espera la
   respuesta, así que es seguro desde el ticker. Verificado contra la fuente de
   `tauri-runtime-wry` 2.11.4, no de memoria.

## Tareas

| # | Qué                                                                                              | Archivos                                          |
| - | ------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| 1 | `cycle_ms` en `Paused`, preservado por `resume`, y fuera del `serde(skip)` + tests                | `src-tauri/src/timer.rs`                          |
| 2 | `modes.rs`: enum `Mode`, `ambient_rect` puro, conmutación, geometría, posición del widget + tests | `src-tauri/src/modes.rs`                          |
| 3 | Las tres ventanas y sus permisos                                                                 | `tauri.conf.json`, `capabilities/default.json`    |
| 4 | Arranque, cierre y enganche del ticker                                                           | `src-tauri/src/lib.rs`                            |
| 5 | Los tres modos en la bandeja, con marca del activo                                               | `src-tauri/src/tray.rs`                           |
| 6 | `cycleProgress` + `isFinalStretch` + `cycleMs` en el tipo `Phase` + tests                        | `src/timer.ts`, `src/timer.test.ts`               |
| 7 | Ruteo por `?view=` y las tres vistas                                                             | `src/main.tsx`, `src/views/*`, `src/index.css`    |

Verificación final: los cinco comandos de CLAUDE.md §7, una sola vez.
