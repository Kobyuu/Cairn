// La ventana es borderless (`decorations: false` en tauri.conf.json), asi que no
// hay barra de titulo de donde agarrarla. `data-tauri-drag-region` le dice a Tauri
// que arrastrar sobre esa zona mueve la ventana; necesita el permiso
// `core:window:allow-start-dragging` declarado en capabilities/default.json.
export default function App() {
  return (
    <main
      data-tauri-drag-region
      className="flex min-h-screen cursor-default select-none flex-col items-center justify-center gap-3 bg-slate-900 font-sans text-slate-100"
    >
      <h1 className="text-4xl font-semibold tracking-tight">Cairn</h1>
      <p className="text-sm text-slate-400">Etapa 1: el toolchain funciona.</p>
    </main>
  );
}
