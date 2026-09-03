// Espejo exacto del wire de `settings.rs`. En `store.json` las claves van en
// snake_case (lo fija la spec, y el archivo tiene que poder abrirse con el
// Bloc de Notas); hacia el frontend salen en camelCase, igual que el snapshot
// del temporizador. El test `the_wire_format_to_the_frontend_is_camel_case` de
// Rust clava ese contrato del otro lado.

export interface WidgetPos {
  x: number;
  y: number;
}

export interface Settings {
  intervalMin: number;
  defaultMode: string;
  quickSnoozeMin: number;
  /** `null` = todavia nadie movio el widget. La etapa 4 decide la posicion. */
  widgetPos: WidgetPos | null;
  autostart: boolean;
  /** `"system"` | `"dark"` | `"light"`. Lo traduce `resolveTheme`. */
  theme: string;
  soundOnAlert: boolean;
  /** El nombre del monitor elegido, o `null` = el primario. */
  monitor: string | null;
}

/** Una pantalla conectada, como la lista `modes_monitors`. */
export interface MonitorInfo {
  /** El identificador de Windows (`\\.\DISPLAY1`). Es lo que se guarda. */
  name: string;
  width: number;
  height: number;
  primary: boolean;
}

/** El evento con el que Rust avisa que `store.json` cambio. */
export const SETTINGS_CHANGED = "settings-changed";
