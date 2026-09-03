import { useState } from "react";
import type { Phase } from "../timer";
import { elapsedMs, formatDuration, parseMinutes, remainingMs } from "../timer";
import { useRoutine } from "../useRoutine";
import { useSettings } from "../useSettings";
import { useTimer } from "../useTimer";
import Routine from "./Routine";

// Pantalla de Foco segun docs/DESIGN.md §4 (direccion "Aliento").
//
// Etapa 4: Foco es la ventana del modo Foco -pantalla completa, elegida a
// mano desde el widget o la bandeja- y ademas la que Rust muestra sola al
// vencer el ciclo, sin importar en que modo estaba. `running` y `paused`
// tambien se pintan aca (para cuando el usuario elige quedarse en Foco);
// `Widget.tsx` y `Ambient.tsx` son las otras dos vistas de `running`.

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

/**
 * Cuelga una capa circular de `size` px del ancla del fondo.
 *
 * Se centra con margenes negativos y no con `translate(-50%,-50%)` porque el
 * `transform` de estas capas ya esta ocupado: las animaciones de respiracion
 * (`cairn-halo`, `cairn-wash`) lo usan para escalar, y una segunda regla de
 * transform lo pisaria y mandaria los circulos a la esquina.
 */
function centered(size: number) {
  return {
    left: "50%",
    top: 0,
    width: size,
    height: size,
    marginLeft: -size / 2,
    marginTop: -size / 2,
  } as const;
}

/** Las capas de fondo: wash, tres halos desfasados, arco, grano y viñeta. */
function Backdrop({ lifted }: Readonly<{ lifted: boolean }>) {
  return (
    <>
      {/* El ancla de las capas circulares. Con un panel abierto sube del centro
          al 22 % para dejarle la mitad de abajo al contenido (handoff "Cairn
          Rutina"). Es un div de altura cero: solo aporta el punto del que
          cuelgan los circulos. */}
      <div
        className="cairn-shift pointer-events-none absolute right-0 left-0"
        style={{
          top: lifted ? "22%" : "50%",
          height: 0,
          transitionProperty: "top",
        }}
      >
        <div
          className="cairn-wash absolute rounded-full"
          style={{
            ...centered(900),
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
            className="cairn-halo absolute rounded-full"
            style={{
              ...centered(halo.size),
              border: `1px solid ${halo.tint}`,
              animationDelay: halo.delay,
            }}
          />
        ))}
        <div
          className="cairn-turn absolute rounded-full"
          style={{ ...centered(212), borderTop: "1px solid var(--ac-55)" }}
        />
      </div>
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
          {
            key: "tl",
            top: 34,
            left: 44,
            borderTop: HAIRLINE,
            borderLeft: HAIRLINE,
          },
          {
            key: "tr",
            top: 34,
            right: 44,
            borderTop: HAIRLINE,
            borderRight: HAIRLINE,
          },
          {
            key: "bl",
            bottom: 34,
            left: 44,
            borderBottom: HAIRLINE,
            borderLeft: HAIRLINE,
          },
          {
            key: "br",
            bottom: 34,
            right: 44,
            borderBottom: HAIRLINE,
            borderRight: HAIRLINE,
          },
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

/**
 * La pista itálica del pie: dice qué se puede hacer ahora mismo.
 *
 * Vive afuera del componente porque es una decisión de tres ramas y adentro de
 * un `return` es un ternario anidado, que es exactamente lo que no se entiende
 * de un vistazo seis meses después.
 */
function footerHint(routineOpen: boolean, editing: boolean): string {
  if (routineOpen && editing) {
    return "los cambios se guardan en tu documento de rutina";
  }
  if (routineOpen) {
    return "tocá una casilla para marcarla · el ciclo sigue esperando";
  }
  return "el ciclo no vuelve a contar hasta que confirmás";
}

/** Etiqueta entre dos hairlines de 56 px. Mono 10 px, 38 %. */
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
  active = false,
  disabled = false,
  padding = "12px 20px",
}: Readonly<{
  children: React.ReactNode;
  onClick: () => void;
  solid?: boolean;
  active?: boolean;
  disabled?: boolean;
  padding?: string;
}>) {
  // `active` marca el panel abierto: la pastilla se tiñe de acento sin llegar a
  // ser sólida, que es lo que distingue "esto está abierto" de "esta es LA
  // acción de la pantalla".
  let ink = "var(--fg-66)";
  let edge = "var(--fg-20)";
  if (solid) {
    ink = "var(--color-bg)";
    edge = "var(--color-ac)";
  } else if (active) {
    ink = "var(--color-ac)";
    edge = "var(--ac-55)";
  }

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
        color: ink,
        border: `1px solid ${edge}`,
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

export default function Foco() {
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
  const routine = useRoutine();
  const [showSettings, setShowSettings] = useState(false);
  const [showRoutine, setShowRoutine] = useState(false);
  const [customMinutes, setCustomMinutes] = useState("");

  // Los dos paneles comparten la misma region y el mismo estado "abierto": el
  // encabezado se encoge una sola vez, no una por panel.
  const panelOpen = showSettings || showRoutine;

  const toggleRoutine = () => {
    const opening = !showRoutine;
    setShowRoutine(opening);
    if (opening) {
      setShowSettings(false);
      // Se relee del disco en cada apertura: el archivo es la fuente de verdad
      // y puede haber cambiado desde afuera con el Bloc de Notas.
      routine.reload();
    }
  };

  const toggleSettings = () => {
    const opening = !showSettings;
    setShowSettings(opening);
    if (opening) setShowRoutine(false);
  };

  if (snapshot === null) {
    return (
      <main className="flex h-full items-center justify-center font-sans">
        <p
          className="font-mono"
          style={{ fontSize: 10, letterSpacing: ".3em", color: "var(--fg-38)" }}
        >
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
      // Sin drag region: a partir de la etapa 4, Foco ocupa el monitor entero
      // y no se mueve ni se maximiza, asi que arrastrarla no tiene sentido
      // -solo dejaria una ventana de pantalla completa "flotando" fuera de
      // lugar-. El drag region con "deep" sigue siendo la solucion correcta
      // para el Widget, que si es una ventana chica y movible.
      className="relative h-full w-full overflow-hidden font-sans"
    >
      <Backdrop lifted={panelOpen} />
      <Overline>
        {showSettings ? "AJUSTES" : `CICLO DE ${intervalMin} MIN`}
      </Overline>

      {/* El encabezado. Con un panel abierto sube y el cronometro se encoge de
          196 a 60 px; la fila de botones NO se mueve (docs/DESIGN.md §4), y por
          eso esta anclada al pie y no colgando de este bloque. */}
      {/* Con el panel CERRADO el bloque va centrado en la ventana, que es donde
          esta el halo: si el cronometro se queda arriba y el halo en el medio,
          la pantalla se parte en dos mitades que no se hablan. Los 121 px son
          la mitad del alto del bloque (sobre-linea + cronometro de 196 px +
          INHALAR), asi que `calc(50vh - 130px)` lo deja con su centro optico en
          el centro de la ventana. Al abrirse un panel sube a 76 px, apenas
          debajo de la sobre-linea, y le deja la pantalla al contenido.

          `pointer-events-none`: el bloque no tiene nada interactivo, y abierto
          su alto -que incluye los huecos reservados de la sobre-linea y de
          INHALAR, invisibles pero presentes- pasa los 172 px donde empieza el
          panel. Sin esto se comeria los clicks de EDITAR. */}
      <div
        className="cairn-shift pointer-events-none absolute top-0 right-0 left-0 flex flex-col items-center"
        style={{
          paddingTop: panelOpen ? 58 : "calc(50vh - 130px)",
          transitionProperty: "padding-top",
        }}
      >
        <div
          className="cairn-fade"
          style={{
            fontStyle: "italic",
            fontSize: 19,
            color: "var(--fg-52)",
            opacity: panelOpen ? 0 : 1,
            transitionProperty: "opacity",
          }}
        >
          {overline}
        </div>
        <div
          className="cairn-shift"
          style={{
            fontSize: panelOpen ? 60 : 196,
            fontWeight: 300,
            lineHeight: 0.92,
            letterSpacing: "-.025em",
            fontVariantNumeric: "tabular-nums",
            // 24 y no los 6 del handoff: con `line-height: .92` la caja del
            // cronometro queda mas corta que sus propios glifos, asi que a
            // 196 px las cifras se suben y le pisan la sobre-linea italica.
            marginTop: 24,
            transitionProperty: "font-size",
          }}
        >
          {clock}
        </div>
        {/* La marca de respiracion solo tiene sentido durante la pausa y con el
            panel cerrado, pero el hueco se reserva siempre. */}
        <div
          className="cairn-fade flex items-center gap-3.5 font-mono"
          style={{
            marginTop: 20,
            fontSize: 10,
            letterSpacing: ".3em",
            color: "var(--fg-34)",
            opacity: isElapsed && !panelOpen ? 1 : 0,
            transitionProperty: "opacity",
          }}
        >
          <div
            className="cairn-breathe rounded-full"
            style={{ width: 5, height: 5, background: "var(--color-ac)" }}
          />
          <div>INHALAR · EXHALAR</div>
        </div>
      </div>

      {/* La region de los paneles: 172 px abajo del borde y 142 arriba de la
          fila de botones. Los dos paneles quedan MONTADOS y se muestran con
          `display`, para que colapsar la rutina a mitad de una edicion no tire
          el borrador. */}
      <div
        className="cairn-fade absolute right-0 left-0 flex justify-center"
        style={{
          top: 172,
          bottom: 142,
          opacity: panelOpen ? 1 : 0,
          pointerEvents: panelOpen ? "auto" : "none",
          transitionProperty: "opacity",
        }}
      >
        <div
          className="overflow-y-auto"
          style={{
            display: showSettings ? "block" : "none",
            width: 720,
            maxWidth: "calc(100vw - 96px)",
          }}
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
              <span
                className="font-mono"
                style={{
                  fontSize: 10,
                  letterSpacing: ".2em",
                  color: "var(--fg-38)",
                }}
              >
                MIN
              </span>
            </Row>
            <div style={{ height: 1, background: "var(--fg-10)" }} />
            <Row
              title="Posponer rápido"
              hint="LO QUE SUMA EL BOTÓN DE POSPONER"
            >
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
            <Row
              title="Iniciar con Windows"
              hint="LEE EL ESTADO REAL DEL REGISTRO, NO EL ARCHIVO"
            >
              <Switch
                label="Iniciar con Windows"
                on={settings?.autostart ?? false}
                onChange={(next) => void setAutostart(next)}
              />
            </Row>
          </Section>

          <div
            className="font-mono"
            style={{
              fontSize: 10,
              letterSpacing: ".3em",
              color: "var(--fg-30)",
              marginTop: 40,
            }}
          >
            LOS AJUSTES SE GUARDAN AL INSTANTE
          </div>
        </div>

        <Routine routine={routine} hidden={!showRoutine} />
      </div>

      {/* La fila de botones vive anclada al pie, igual abierta que cerrada.
          Es la regla dura de docs/DESIGN.md §4: `LISTO` es la unica accion que
          no puede reubicarse nunca. */}
      <div
        className="absolute right-0 left-0 flex items-center justify-center gap-3"
        style={{ bottom: 88 }}
      >
        {/* LISTO cierra la pausa: reinicia el ciclo Y deja la rutina limpia
            para la proxima. Son dos efectos y no uno solo porque el ciclo vive
            en Rust y la rutina es un archivo; el orden importa poco, pero el
            temporizador va primero porque es lo que el usuario esta mirando. */}
        <Pill
          solid
          padding="12px 34px"
          onClick={() => {
            void reset();
            routine.clearChecks();
          }}
        >
          LISTO
        </Pill>
        <Pill onClick={() => void snooze()}>posponer {snoozeMin}</Pill>
        <Pill
          onClick={() => void (isPaused ? resume() : pause())}
          disabled={isElapsed}
        >
          {isPaused ? "reanudar" : "pausar"}
        </Pill>
        <Pill active={showRoutine} onClick={toggleRoutine}>
          {showRoutine ? "ocultar rutina" : "ver rutina"}
        </Pill>
        <Pill onClick={toggleSettings}>
          {showSettings ? "volver" : "ajustes"}
        </Pill>
      </div>

      <div
        className="absolute right-0 left-0 text-center"
        style={{
          bottom: 52,
          fontStyle: "italic",
          fontSize: 14,
          color: "var(--fg-30)",
        }}
      >
        {footerHint(showRoutine, routine.mode === "edit")}
      </div>
    </main>
  );
}
