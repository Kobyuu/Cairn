import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";
import type { TimerSnapshot } from "./timer";

/**
 * Hook que expone el snapshot del temporizador (dueño Rust) y un "ahora"
 * propio del frontend para derivar el restante/transcurrido en cada render.
 *
 * El "ahora" se refresca con un setInterval que REASIGNA Date.now() cada
 * 250ms — no suma nada a un acumulador. No viola la regla de la spec
 * ("prohibido setInterval que acumule segundos"): el valor de verdad sigue
 * siendo deadlineMs/sinceMs, que vive en Rust; este intervalo solo fuerza un
 * re-render para que la resta (deadlineMs - nowMs) se recalcule a tiempo.
 */
export function useTimer() {
  const [snapshot, setSnapshot] = useState<TimerSnapshot | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    // El orden importa: primero queda registrado el listener y RECIEN despues
    // se pide el snapshot inicial. Al reves hay una carrera de arranque — si la
    // ventana monta justo en el segundo del vencimiento, el evento `elapsed`
    // llega antes de que resuelva el invoke, y el snapshot viejo lo pisa: la
    // UI queda en `running` con el deadline pasado, clavada en 00:00.
    const unlistenPromise = listen<TimerSnapshot>("timer-changed", (event) => {
      setSnapshot(event.payload);
    }).then((unlisten) => {
      invoke<TimerSnapshot>("timer_snapshot")
        // El snapshot inicial solo llena el hueco: si un evento llego primero,
        // ese es mas nuevo y gana. Cierra la ventana que queda entre el pedido
        // y su respuesta, donde el snapshot viejo podria pisar al evento.
        .then((initial) => setSnapshot((current) => current ?? initial))
        .catch(console.error);
      return unlisten;
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten()).catch(console.error);
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  // Cada accion aplica el snapshot que devuelve Rust. El `catch` no es adorno:
  // sin el, un comando que rechaza deja el boton pareciendo muerto y sin rastro
  // en ningun lado. El error del webview no aparece en la terminal de cargo.
  const run = (command: string, args?: Record<string, unknown>) =>
    invoke<TimerSnapshot>(command, args).then(setSnapshot).catch(console.error);

  const pause = () => run("timer_pause");
  const resume = () => run("timer_resume");
  const reset = () => run("timer_reset");
  const snooze = (minutes?: number) => run("timer_snooze", { minutes: minutes ?? null });
  const setIntervalMinutes = (minutes: number) => run("timer_set_interval", { minutes });
  // Ajuste, no accion: cambia lo que va a sumar el proximo posponer y NO mueve
  // el reloj. `snooze` si lo mueve. Ver el comentario de `timer_set_quick_snooze`.
  const setQuickSnoozeMinutes = (minutes: number) =>
    run("timer_set_quick_snooze", { minutes });

  return {
    snapshot,
    nowMs,
    pause,
    resume,
    reset,
    snooze,
    setIntervalMinutes,
    setQuickSnoozeMinutes,
  };
}
