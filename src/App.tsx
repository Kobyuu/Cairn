import { useState } from "react";
import type { Phase } from "./timer";
import { elapsedMs, formatDuration, parseMinutes, remainingMs } from "./timer";
import { useSettings } from "./useSettings";
import { useTimer } from "./useTimer";

// Pantalla de Foco segun docs/DESIGN.md §4 (direccion "Aliento").
//
// Adaptacion anotada de la etapa 3: el handoff dibuja Foco en su estado vencido
// -sobre-linea "llevas en pausa" y cronometro ascendente-. Como hasta la etapa 4
// hay una sola ventana, la misma pantalla cubre tambien `running` y `paused`
// cambiando la sobre-linea y la fila de botones; el encuadre es identico. Cuando
// lleguen los tres modos, `running` se va al Widget y al Ambiente.

const CHIP_INTERVALS = [25, 45, 60, 90];
const CHIP_SNOOZES = [2, 5, 10, 15];
const HAIRLINE = "1px solid var(--fg-25)";

// La sobre-linea de Foco, indexada por fase. Como el tipo es `Record` sobre
// `Phase["kind"]`, agregar una fase al core sin darle su texto no compila: es la
// misma exhaustividad que da un `switch`, sin el ternario anidado.
const OVERLINE: Record<Phase["kind"], string> = {
  elapsed: "llevás en pausa",
  paused: "temporizador detenido",
  running: "falta para la pausa",
};

/** Las capas de fondo: wash, tres halos desfasados, arco, grano y viñeta. */
function Backdrop() {
  return (
    <>
      <div
        className="cairn-wash pointer-events-none absolute rounded-full"
        style={{
          width: 900,
          height: 900,
          background:
            "radial-gradient(circle, var(--fg-9) 0%, transparent 62%)",
        }}
      />
      {/* 660 / 520 / 400 px, bordes al 13 / 10 / 8 %, desfase 0 / .7 / 1.4 s.
          El desfase es lo que hace que respiren como uno y no como tres. */}
      {[
        { size: 660, tint: "var(--fg-13)", delay: "0s" },
        { size: 520, tint: "var(--fg-10)", delay: "0.7s" },
        { size: 400, tint: "var(--fg-8)", delay: "1.4s" },
      ].map((halo) => (
        <div
          key={halo.size}
          className="cairn-halo pointer-events-none absolute rounded-full"
          style={{
            width: halo.size,
            height: halo.size,
            border: `1px solid ${halo.tint}`,
            animationDelay: halo.delay,
          }}
        />
      ))}
      <div
        className="cairn-turn pointer-events-none absolute rounded-full"
        style={{ width: 212, height: 212, borderTop: "1px solid var(--ac-55)" }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle, var(--fg-12) .6px, transparent .6px)",
          backgroundSize: "3px 3px",
          opacity: 0.5,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 42%, var(--bg-82) 100%)",
        }}
      />
      {/* Escuadras de encuadre, 9 px a 34 / 44 px de los bordes. Es lo que se
          rescato de la direccion "Grafica". */}
      {(
        [
          { key: "tl", top: 34, left: 44, borderTop: HAIRLINE, borderLeft: HAIRLINE },
          { key: "tr", top: 34, right: 44, borderTop: HAIRLINE, borderRight: HAIRLINE },
          { key: "bl", bottom: 34, left: 44, borderBottom: HAIRLINE, borderLeft: HAIRLINE },
          { key: "br", bottom: 34, right: 44, borderBottom: HAIRLINE, borderRight: HAIRLINE },
        ] as const
      ).map(({ key, ...corner }) => (
        <div
          key={key}
          className="pointer-events-none absolute"
          style={{ width: 9, height: 9, ...corner }}
        />
      ))}
    </>
  );
}

/** Etiqueta entre dos hairlines de 56 px. Mono 10 px, .34em, 38 %. */
function Overline({ children }: Readonly<{ children: string }>) {
  return (
    <div
      className="absolute right-0 left-0 flex items-center justify-center gap-4.5 font-mono"
      style={{
        top: 46,
        fontSize: 10,
        letterSpacing: ".34em",
        color: "var(--fg-38)",
      }}
    >
      <div style={{ width: 56, height: 1, background: "var(--fg-22)" }} />
      <div>{children}</div>
      <div style={{ width: 56, height: 1, background: "var(--fg-22)" }} />
    </div>
  );
}

/** Pastilla de accion. `solid` es la unica accion primaria de la pantalla. */
function Pill({
  children,
  onClick,
  solid = false,
  disabled = false,
  padding = "12px 20px",
}: Readonly<{
  children: React.ReactNode;
  onClick: () => void;
  solid?: boolean;
  disabled?: boolean;
  padding?: string;
}>) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="cairn-press rounded-full font-mono disabled:opacity-40"
      style={{
        padding,
        fontSize: 12,
        letterSpacing: solid ? ".14em" : ".06em",
        background: solid ? "var(--color-ac)" : "transparent",
        color: solid ? "var(--color-bg)" : "var(--fg-66)",
        border: solid ? "1px solid var(--color-ac)" : "1px solid var(--fg-20)",
      }}
    >
      {children}
    </button>
  );
}

/** Chip de ajustes: sin radio, borde al 18 %, activo con fondo de acento. */
function Chip({
  label,
  active,
  onClick,
}: Readonly<{
  label: string;
  active: boolean;
  onClick: () => void;
}>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cairn-press font-mono"
      style={{
        padding: "9px 15px",
        fontSize: 11,
        letterSpacing: ".1em",
        background: active ? "var(--color-ac)" : "transparent",
        color: active ? "var(--color-bg)" : "var(--fg-66)",
        border: `1px solid ${active ? "var(--color-ac)" : "var(--fg-18)"}`,
      }}
    >
      {label}
    </button>
  );
}

/** Interruptor de 52 × 26 px con punto de 18 px. */
function Switch({
  on,
  onChange,
  label,
}: Readonly<{
  on: boolean;
  onChange: (next: boolean) => void;
  label: string;
}>) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className="cairn-press relative rounded-full"
      style={{
        width: 52,
        height: 26,
        border: `1px solid ${on ? "var(--color-ac)" : "var(--fg-22)"}`,
        background: on
          ? "color-mix(in oklab, var(--color-ac) 22%, transparent)"
          : "transparent",
      }}
    >
      <span
        className="absolute rounded-full"
        style={{
          width: 18,
          height: 18,
          top: 3,
          left: on ? 29 : 3,
          background: on ? "var(--color-ac)" : "var(--fg-38)",
          transition: "left 150ms ease, background-color 150ms ease",
        }}
      />
    </button>
  );
}

/** Fila de ajustes: titulo + descripcion a la izquierda, control a la derecha. */
function Row({
  title,
  hint,
  children,
}: Readonly<{
  title: string;
  hint: string;
  children: React.ReactNode;
}>) {
  return (
    <div className="flex items-center justify-between gap-8 py-6">
      <div>
        <div style={{ fontSize: 23, fontWeight: 300 }}>{title}</div>
        <div
          className="font-mono"
          style={{ fontSize: 11, color: "var(--fg-42)", marginTop: 6 }}
        >
          {hint}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

function Section({
  title,
  children,
}: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <>
      <div
        className="font-mono"
        style={{
          fontSize: 10,
          letterSpacing: ".3em",
          color: "var(--fg-38)",
          marginTop: 48,
        }}
      >
        {title}
      </div>
      {children}
    </>
  );
}

export default function App() {
  const {
    snapshot,
    nowMs,
    pause,
    resume,
    reset,
    snooze,
    setIntervalMinutes,
    setQuickSnoozeMinutes,
  } = useTimer();
  const { settings, setAutostart } = useSettings();
  const [showSettings, setShowSettings] = useState(false);
  const [customMinutes, setCustomMinutes] = useState("");

  if (snapshot === null) {
    return (
      <main className="flex h-full items-center justify-center font-sans">
        <p className="font-mono" style={{ fontSize: 10, letterSpacing: ".3em", color: "var(--fg-38)" }}>
          CARGANDO
        </p>
      </main>
    );
  }

  const { phase } = snapshot;
  const isElapsed = phase.kind === "elapsed";
  const isPaused = phase.kind === "paused";
  const intervalMin = Math.round(snapshot.intervalMs / 60_000);
  const snoozeMin = Math.round(snapshot.quickSnoozeMs / 60_000);

  // El cronometro sube desde el vencimiento y baja el resto del tiempo. Los dos
  // se derivan del snapshot: el frontend nunca acumula su propio contador.
  const clock = isElapsed
    ? formatDuration(elapsedMs(phase, nowMs))
    : formatDuration(remainingMs(phase, nowMs));

  const overline = OVERLINE[phase.kind];

  return (
    <main
      data-tauri-drag-region
      className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden font-sans"
    >
      <Backdrop />
      <Overline>{showSettings ? "AJUSTES" : `CICLO DE ${intervalMin} MIN`}</Overline>

      {showSettings ? (
        <div
          className="relative overflow-y-auto"
          style={{ width: 720, maxWidth: "calc(100vw - 96px)", maxHeight: "calc(100vh - 220px)" }}
        >
          <Section title="CICLO">
            <Row title="Duración del intervalo" hint="CUÁNTO DURA CADA CICLO">
              {CHIP_INTERVALS.map((minutes) => (
                <Chip
                  key={minutes}
                  label={String(minutes)}
                  active={intervalMin === minutes}
                  onClick={() => void setIntervalMinutes(minutes)}
                />
              ))}
              <input
                type="number"
                min={1}
                value={customMinutes}
                placeholder="—"
                onChange={(event) => setCustomMinutes(event.target.value)}
                // Enter ademas de blur: tipear un numero y apretar Enter es el
                // gesto natural, y sin esto no pasaba nada. Y se compara contra
                // el intervalo vigente para no mandar un invoke -y una escritura
                // a disco- cada vez que el foco sale del campo sin cambios.
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                }}
                onBlur={() => {
                  const parsed = parseMinutes(customMinutes);
                  if (parsed !== null && parsed !== intervalMin) {
                    void setIntervalMinutes(parsed);
                  }
                }}
                className="font-mono"
                style={{
                  width: 64,
                  padding: "9px 10px",
                  fontSize: 11,
                  background: "transparent",
                  color: "var(--color-fg)",
                  border: "1px solid var(--fg-18)",
                }}
              />
              <span className="font-mono" style={{ fontSize: 10, letterSpacing: ".2em", color: "var(--fg-38)" }}>
                MIN
              </span>
            </Row>
            <div style={{ height: 1, background: "var(--fg-10)" }} />
            <Row title="Posponer rápido" hint="LO QUE SUMA EL BOTÓN DE POSPONER">
              {CHIP_SNOOZES.map((minutes) => (
                <Chip
                  key={minutes}
                  label={String(minutes)}
                  active={snoozeMin === minutes}
                  onClick={() => void setQuickSnoozeMinutes(minutes)}
                />
              ))}
            </Row>
          </Section>

          <Section title="SISTEMA">
            <Row title="Iniciar con Windows" hint="LEE EL ESTADO REAL DEL REGISTRO, NO EL ARCHIVO">
              <Switch
                label="Iniciar con Windows"
                on={settings?.autostart ?? false}
                onChange={(next) => void setAutostart(next)}
              />
            </Row>
          </Section>

          <div
            className="font-mono"
            style={{ fontSize: 10, letterSpacing: ".3em", color: "var(--fg-30)", marginTop: 40 }}
          >
            LOS AJUSTES SE GUARDAN AL INSTANTE
          </div>
        </div>
      ) : (
        <div className="relative flex flex-col items-center">
          <div style={{ fontStyle: "italic", fontSize: 19, color: "var(--fg-52)" }}>
            {overline}
          </div>
          <div
            style={{
              fontSize: 196,
              fontWeight: 300,
              lineHeight: 0.92,
              letterSpacing: "-.025em",
              fontVariantNumeric: "tabular-nums",
              marginTop: 6,
            }}
          >
            {clock}
          </div>
          {/* La marca de respiracion solo tiene sentido durante la pausa, pero el
              hueco se reserva siempre: la fila de botones NO se puede mover
              (docs/DESIGN.md §4), y `LISTO` tiene que estar en el mismo pixel. */}
          <div
            className="flex items-center gap-3.5 font-mono"
            style={{
              marginTop: 20,
              fontSize: 10,
              letterSpacing: ".3em",
              color: "var(--fg-34)",
              visibility: isElapsed ? "visible" : "hidden",
            }}
          >
            <div
              className="cairn-breathe rounded-full"
              style={{ width: 5, height: 5, background: "var(--color-ac)" }}
            />
            <div>INHALAR · EXHALAR</div>
          </div>
        </div>
      )}

      <div className="relative flex items-center gap-3" style={{ marginTop: 76 }}>
        <Pill solid padding="12px 34px" onClick={() => void reset()}>
          LISTO
        </Pill>
        <Pill onClick={() => void snooze()}>posponer {snoozeMin}</Pill>
        <Pill onClick={() => void (isPaused ? resume() : pause())} disabled={isElapsed}>
          {isPaused ? "reanudar" : "pausar"}
        </Pill>
        <Pill onClick={() => setShowSettings((open) => !open)}>
          {showSettings ? "volver" : "ajustes"}
        </Pill>
      </div>

      <div
        className="absolute right-0 left-0 text-center"
        style={{ bottom: 52, fontStyle: "italic", fontSize: 14, color: "var(--fg-30)" }}
      >
        el ciclo no vuelve a contar hasta que confirmás
      </div>
    </main>
  );
}
