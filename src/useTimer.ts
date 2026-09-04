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
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;

    // El snapshot inicial se REINTENTA, y no es paranoia: es una carrera de
    // arranque real, reproducible y que dejaba la app inservible.
    //
    // El estado del temporizador se registra con `app.manage()` dentro del
    // `setup()` de Rust, y `setup()` corre DESPUES de que Tauri crea las
    // ventanas declaradas en `tauri.conf.json`. O sea que el webview puede
    // llegar a pedir `timer_snapshot` antes de que el estado exista, y el
    // comando falla con "state not managed for field `state`". Antes ese
    // rechazo caia en un `catch(console.error)` sin reintento: el snapshot se
    // quedaba en `null` y las TRES ventanas mostraban CARGANDO para siempre,
    // con el error en una consola que en release nadie puede abrir.
    //
    // El reintento no tiene tope de intentos a proposito: un tope solo cambia
    // "colgado para siempre" por "colgado despues de N", que es el mismo bug.
    // La espera si tiene tope, para no quedar girando cada 100 ms.
    const pull = (attempt = 0) => {
      invoke<TimerSnapshot>("timer_snapshot")
        // El snapshot inicial solo llena el hueco: si un evento llego primero,
        // ese es mas nuevo y gana. Cierra la ventana que queda entre el pedido
        // y su respuesta, donde el snapshot viejo podria pisar al evento.
        .then((initial) => {
          if (!cancelled) setSnapshot((current) => current ?? initial);
        })
        .catch((cause: unknown) => {
          console.error(cause);
          if (cancelled) return;
          retry = setTimeout(() => pull(attempt + 1), Math.min(2000, 100 * 2 ** attempt));
        });
    };

    // El orden importa: primero queda registrado el listener y RECIEN despues
    // se pide el snapshot inicial. Al reves hay una carrera de arranque — si la
    // ventana monta justo en el segundo del vencimiento, el evento `elapsed`
    // llega antes de que resuelva el invoke, y el snapshot viejo lo pisa: la
    // UI queda en `running` con el deadline pasado, clavada en 00:00.
    const unlistenPromise = listen<TimerSnapshot>("timer-changed", (event) => {
      setSnapshot(event.payload);
    })
      .then((unlisten) => {
        pull();
        return unlisten;
      })
      // Si ni el listener se pudo registrar, el snapshot inicial pasa a ser la
      // unica via de llenar la pantalla: se pide igual. Antes este rechazo no
      // se atajaba en ningun lado y el `invoke` no llegaba a dispararse nunca.
      .catch((cause: unknown) => {
        console.error(cause);
        pull();
        return () => {};
      });

    return () => {
      cancelled = true;
      clearTimeout(retry);
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
