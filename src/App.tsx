import { useState } from "react";
import { elapsedMs, formatDuration, parseMinutes, remainingMs } from "./timer";
import { useTimer } from "./useTimer";

// UI deliberadamente fea (CLAUDE.md §5): sin animaciones, sin hex hardcodeado,
// solo Tailwind basico. El diseno real llega en la etapa 6.
export default function App() {
  const { snapshot, nowMs, pause, resume, reset, snooze, setIntervalMinutes } = useTimer();
  const [snoozeMinutes, setSnoozeMinutes] = useState("10");
  const [intervalMinutes, setIntervalMinutesInput] = useState("45");

  // Los inputs son texto libre. Si no parsean, el boton se deshabilita en vez
  // de mandar un NaN que Rust interpretaria como "sin argumento".
  const parsedSnooze = parseMinutes(snoozeMinutes);
  const parsedInterval = parseMinutes(intervalMinutes);

  // Pausar y reanudar son un solo boton que cambia de texto: son la misma
  // decision del usuario, y dos botones donde uno siempre es un no-op invitan
  // a apretar el que no hace nada. Vencido o sin ciclo no hay nada que pausar.
  const isPaused = snapshot?.phase.kind === "paused";
  const canToggle = isPaused || snapshot?.phase.kind === "running";

  return (
    <main
      data-tauri-drag-region
      className="flex min-h-screen cursor-default select-none flex-col items-center justify-center gap-3 bg-slate-900 font-sans text-slate-100"
    >
      <h1 className="text-4xl font-semibold tracking-tight">Cairn</h1>

      {snapshot === null ? (
        <p className="text-sm text-slate-400">Cargando...</p>
      ) : (
        <>
          <p className="text-sm text-slate-400">fase: {snapshot.phase.kind}</p>

          <p className="font-mono text-6xl tabular-nums">
            {snapshot.phase.kind === "elapsed"
              ? formatDuration(elapsedMs(snapshot.phase, nowMs))
              : formatDuration(remainingMs(snapshot.phase, nowMs))}
          </p>
          {snapshot.phase.kind === "elapsed" && (
            <p className="text-xs text-slate-400">transcurrido desde el vencimiento</p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void (isPaused ? resume() : pause())}
              disabled={!canToggle}
              className="rounded bg-slate-700 px-3 py-1 disabled:opacity-40"
            >
              {isPaused ? "Reanudar" : "Pausar"}
            </button>
            <button
              type="button"
              onClick={() => void reset()}
              className="rounded bg-slate-700 px-3 py-1"
            >
              Reiniciar / Listo
            </button>
            <button
              type="button"
              onClick={() => void snooze()}
              className="rounded bg-slate-700 px-3 py-1"
            >
              Posponer 5
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={snoozeMinutes}
              onChange={(event) => setSnoozeMinutes(event.target.value)}
              className="w-16 rounded bg-slate-800 px-2 py-1 text-slate-100"
            />
            <button
              type="button"
              onClick={() => parsedSnooze !== null && void snooze(parsedSnooze)}
              disabled={parsedSnooze === null}
              className="rounded bg-slate-700 px-3 py-1 disabled:opacity-40"
            >
              Posponer N min
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={intervalMinutes}
              onChange={(event) => setIntervalMinutesInput(event.target.value)}
              className="w-16 rounded bg-slate-800 px-2 py-1 text-slate-100"
            />
            <button
              type="button"
              onClick={() => parsedInterval !== null && void setIntervalMinutes(parsedInterval)}
              disabled={parsedInterval === null}
              className="rounded bg-slate-700 px-3 py-1 disabled:opacity-40"
            >
              Cambiar intervalo
            </button>
          </div>
        </>
      )}
    </main>
  );
}
