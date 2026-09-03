import React from "react";
import ReactDOM from "react-dom/client";
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
