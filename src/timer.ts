// Tipos y funciones puras del temporizador. Reflejan exactamente el wire de
// Rust (ver SPEC-timer-core.md): el "ahora" siempre se inyecta como parametro,
// nunca se lee del reloj adentro de estas funciones, para que sean testeables
// sin esperar minutos reales y para que el frontend nunca acumule su propio
// contador (la resta se hace cada vez contra deadlineMs/sinceMs).

export type Phase =
  | { kind: "idle" }
  | { kind: "running"; deadlineMs: number }
  | { kind: "paused"; remainingMs: number }
  | { kind: "elapsed"; sinceMs: number };

export interface TimerSnapshot {
  phase: Phase;
  intervalMs: number;
  quickSnoozeMs: number;
}

/** Tiempo restante hasta el vencimiento. Nunca negativo. */
export function remainingMs(phase: Phase, nowMs: number): number {
  switch (phase.kind) {
    case "running":
      return Math.max(0, phase.deadlineMs - nowMs);
    case "paused":
      return phase.remainingMs;
    case "idle":
    case "elapsed":
      return 0;
  }
}

/** Cronometro ascendente desde que vencio. Nunca negativo. */
export function elapsedMs(phase: Phase, nowMs: number): number {
  if (phase.kind === "elapsed") {
    return Math.max(0, nowMs - phase.sinceMs);
  }
  return 0;
}

/**
 * Parsea minutos tipeados a mano. Devuelve null si no son un entero >= 1.
 *
 * Sin esto, un `Number("abc")` da NaN, JSON.stringify lo manda como null, y
 * Rust lo lee como "sin argumento": el usuario pide posponer 17 y le posponen
 * los 5 del atajo rapido, sin un solo error. Un modo de falla que miente es
 * peor que uno que rompe.
 */
export function parseMinutes(input: string): number | null {
  const value = Number(input);
  if (!Number.isFinite(value)) {
    return null;
  }
  const minutes = Math.trunc(value);
  return minutes >= 1 ? minutes : null;
}

/** Formatea una duracion en ms como "mm:ss", o "h:mm:ss" a partir de la hora. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  if (hours > 0) {
    return `${hours}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}
