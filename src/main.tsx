import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import React from "react";
import ReactDOM from "react-dom/client";
import { SETTINGS_CHANGED, type Settings } from "./settings";
import { resolveTheme } from "./theme";
import Ambient from "./views/Ambient";
import Foco from "./views/Foco";
import Widget from "./views/Widget";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("No existe #root en index.html");

// Un solo bundle, tres ventanas: Rust abre cada una con `index.html?view=...`
// (CLAUDE.md §1). El frontend no sabe nada de "modos" -eso vive en Rust-, solo
// lee el query param y pinta la vista que le toca. Cualquier valor ausente o
// desconocido cae en Foco, que es la vista que Rust tambien usa al vencer.
type View = "foco" | "widget" | "ambient";

function resolveView(): View {
  const requested = new URLSearchParams(window.location.search).get("view");
  return requested === "widget" || requested === "ambient" ? requested : "foco";
}

const view = resolveView();
// El CSS distingue las vistas por este atributo (fondo transparente de Widget
// y Ambiente en index.css). Se setea ANTES de renderizar para que no haya un
// primer pintado con el fondo opaco del tema.
document.documentElement.dataset.view = view;

// El tema, para las TRES ventanas y sin pasar por React.
//
// Vive aca y no en un componente porque no es estado de ninguna vista: es un
// atributo del documento que el CSS lee (`[data-theme="light"]` en index.css).
// Las tres ventanas estan vivas a la vez -aunque dos esten escondidas-, asi que
// cada una se suscribe a `settings-changed` y cambia sola; sin eso, el Widget
// se quedaria en el tema viejo hasta que alguien lo reabra.
//
// El primer pintado es siempre el oscuro, que es el default del producto: el
// ajuste llega por IPC un instante despues. Con tema claro elegido eso es un
// parpadeo de un cuadro al arrancar, y el precio de no bloquear el render
// esperando al disco.
const prefersLight = window.matchMedia("(prefers-color-scheme: light)");
let themeSetting = "dark";

function paintTheme() {
  document.documentElement.dataset.theme = resolveTheme(
    themeSetting,
    prefersLight.matches,
  );
}

function watchTheme() {
  paintTheme();
  // Con el ajuste en "Sistema", cambiar el tema de Windows tiene que alcanzar
  // a la app sin reiniciarla.
  prefersLight.addEventListener("change", paintTheme);
  listen<Settings>(SETTINGS_CHANGED, (event) => {
    themeSetting = event.payload.theme;
    paintTheme();
  }).catch(console.error);
  invoke<Settings>("settings_snapshot")
    .then((settings) => {
      themeSetting = settings.theme;
      paintTheme();
    })
    .catch(console.error);
}

watchTheme();

const VIEWS: Record<View, React.ComponentType> = {
  foco: Foco,
  widget: Widget,
  ambient: Ambient,
};

const ViewComponent = VIEWS[view];

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <ViewComponent />
  </React.StrictMode>,
);
