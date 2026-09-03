// Tipos y funciones puras del temporizador. Reflejan exactamente el wire de
// Rust (ver SPEC-timer-core.md): el "ahora" siempre se inyecta como parametro,
// nunca se lee del reloj adentro de estas funciones, para que sean testeables
// sin esperar minutos reales y para que el frontend nunca acumule su propio
// contador (la resta se hace cada vez contra deadlineMs/sinceMs).

// No hay "idle": el ciclo siempre nace corriendo, con la hora de pared real
// leida en el arranque del core. Ver el comentario de `Phase` en timer.rs.
// `cycleMs` es el largo NOMINAL del ciclo en curso, que no siempre es el
// intervalo configurado: posponer 5 min con un intervalo de 45 abre un ciclo de
// 5. Es lo unico contra lo que se puede medir el avance, y por eso viaja al
// frontend desde la etapa 4: la barra de Ambiente y el hairline del widget
// pintan porcentaje de CICLO, no de intervalo.
export type Phase =
  | { kind: "running"; deadlineMs: number; cycleMs: number }
  | { kind: "paused"; remainingMs: number; cycleMs: number }
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
 * Umbral del ultimo tramo del ciclo: el 10 % final (docs/DESIGN.md §4).
 *
 * Es donde la barra de Ambiente engorda de 3 a 5 px y empieza a respirar, y
 * donde el hairline del widget pasa de 2 a 3 px. Vive aca y no en cada vista
 * porque las dos tienen que cambiar en el mismo instante.
 */
export const FINAL_STRETCH = 0.9;

/**
 * Avance del ciclo en curso, de 0 a 1, **escalonado de a 1 %**.
 *
 * El escalon es del handoff, no una optimizacion: "pasos de 1 % del ancho, sin
 * easing". Una barra que se mueve continuamente pide que la mires; una que
 * salta de a un porciento se lee de reojo.
 *
 * Se mide contra `cycleMs` y no contra el intervalo configurado por el mismo
 * motivo por el que Rust lo manda: un posponer de 5 min tiene que llenar la
 * barra en 5 minutos.
 */
export function cycleProgress(phase: Phase, nowMs: number): number {
  if (phase.kind === "elapsed") {
    return 1;
  }
  // Rust acota los minutos a >= 1 antes de convertirlos, asi que un ciclo de
  // cero no deberia existir. La guarda esta igual porque es una division.
  if (phase.cycleMs <= 0) {
    return 1;
  }
  const spent = phase.cycleMs - remainingMs(phase, nowMs);
  const ratio = spent / phase.cycleMs;
  return Math.min(1, Math.max(0, Math.floor(ratio * 100) / 100));
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
