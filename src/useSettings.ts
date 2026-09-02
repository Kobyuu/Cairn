import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import type { Settings } from "./settings";

/**
 * Hook de los ajustes persistidos.
 *
 * Solo expone el autostart. El intervalo NO se lee de aca aunque viva en
 * `store.json`: el valor vigente es el `intervalMs` del snapshot del
 * temporizador, que es quien lo usa. Tener dos fuentes para el mismo numero es
 * como se llega a una UI que muestra 45 mientras el core cuenta 30.
 *
 * `settings_snapshot` devuelve el autostart REAL -se lo pregunta al registro de
 * Windows a traves del plugin, no al JSON-, asi que abrir la app despues de
 * sacar la entrada a mano desde el Administrador de tareas muestra el estado
 * verdadero y de paso corrige el archivo.
 */
export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    invoke<Settings>("settings_snapshot").then(setSettings).catch(console.error);
  }, []);

  // El `catch` no es adorno: si el registro de Windows rechaza el cambio, el
  // comando devuelve error y sin esto el checkbox se quedaria mudo. El error
  // del webview no aparece en la terminal de cargo.
  const setAutostart = (enabled: boolean) =>
    invoke<Settings>("settings_set_autostart", { enabled })
      .then(setSettings)
      .catch(console.error);

  return { settings, setAutostart };
}
