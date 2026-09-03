import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";
import { SETTINGS_CHANGED, type Settings } from "./settings";

/**
 * Hook de los ajustes persistidos.
 *
 * El intervalo y el posponer rapido NO se leen de aca aunque vivan en
 * `store.json`: el valor vigente es el del snapshot del temporizador, que es
 * quien lo usa. Tener dos fuentes para el mismo numero es como se llega a una
 * UI que muestra 45 mientras el core cuenta 30.
 *
 * `settings_snapshot` devuelve el autostart REAL -se lo pregunta al registro de
 * Windows a traves del plugin, no al JSON-, asi que abrir la app despues de
 * sacar la entrada a mano desde el Administrador de tareas muestra el estado
 * verdadero y de paso corrige el archivo.
 */
export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    // Mismo orden que en `useTimer`: primero el listener y despues el pedido
    // inicial, para que un cambio hecho desde otra ventana justo en el arranque
    // no lo pise la respuesta del snapshot.
    const unlistenPromise = listen<Settings>(SETTINGS_CHANGED, (event) => {
      setSettings(event.payload);
    }).then((unlisten) => {
      invoke<Settings>("settings_snapshot")
        .then((initial) => setSettings((current) => current ?? initial))
        .catch(console.error);
      return unlisten;
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten()).catch(console.error);
    };
  }, []);

  // El `catch` no es adorno: si el registro de Windows rechaza el cambio, el
  // comando devuelve error y sin esto el control se quedaria mudo. El error del
  // webview no aparece en la terminal de cargo.
  const run = (command: string, args?: Record<string, unknown>) =>
    invoke<Settings>(command, args).then(setSettings).catch(console.error);

  const setAutostart = (enabled: boolean) =>
    run("settings_set_autostart", { enabled });
  const setTheme = (theme: string) => run("settings_set_theme", { theme });
  const setSound = (enabled: boolean) => run("settings_set_sound", { enabled });

  // `modes_set` no devuelve los ajustes: conmuta la ventana y Rust emite
  // `settings-changed` por su cuenta, que es lo que actualiza la tarjeta
  // marcada. Es tambien el camino por el que llega el cambio hecho desde la
  // bandeja, asi que no hay dos formas de enterarse.
  const setDefaultMode = (mode: string) =>
    invoke("modes_set", { mode }).catch(console.error);

  // Tampoco devuelve los ajustes: reubica las ventanas y emite
  // `settings-changed`, igual que `modes_set`.
  const setMonitor = (name: string | null) =>
    invoke("modes_set_monitor", { name }).catch(console.error);

  return {
    settings,
    setAutostart,
    setTheme,
    setSound,
    setDefaultMode,
    setMonitor,
  };
}
