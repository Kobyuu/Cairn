import { useState } from "react";
import { cycleProgress, elapsedMs, remainingMs, FINAL_STRETCH } from "../timer";
import { clearRoutineChecks } from "../useRoutine";
import { useSettings } from "../useSettings";
import { useTimer } from "../useTimer";

/** El orden en que rota el boton `MODO`: de menos a mas presente. */
const MODE_ORDER = ["ambient", "widget", "foco"];

/** Caja de 30 px de alto de los controles del hover. */
const CONTROL: React.CSSProperties = {
  height: 30,
  minWidth: 30,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid var(--fg-20)",
  borderRadius: 3,
  color: "var(--fg-66)",
};

/**
 * Las dos lineas de la etiqueta, segun la fase.
 *
 * Funcion pura y afuera del componente, igual que el `footerHint` de `Foco`:
 * es una decision de tres ramas, y adentro del cuerpo del componente compite
 * con el layout por la atencion de quien lee.
 */
function labelFor(isPaused: boolean, isElapsed: boolean): [string, string] {
  if (isPaused) return ["EN", "PAUSA"];
  if (isElapsed) return ["MIN", "DE PAUSA"];
  return ["MIN", "RESTANTES"];
}

/**
 * El color del hairline de progreso, en el mismo orden en que mandan los
 * estados: la pausa gana sobre todo -congelada y en gris-, despues el ultimo
 * tramo, y si no el acento de reposo.
 */
function hairlineInk(isPaused: boolean, final: boolean): string {
  if (isPaused) return "var(--fg-22)";
  if (final) return "var(--ac-90)";
  return "var(--ac-70)";
}

/**
 * El siguiente modo de la rueda del boton `MODO`.
 *
 * Acepta `undefined` -los ajustes pueden no haber llegado todavia- para que el
 * default viva aca y no en el llamador: un modo desconocido cae en `widget`,
 * que es el modo en el que estas si estas viendo el widget.
 */
function nextInWheel(current: string | undefined): string {
  const at = MODE_ORDER.indexOf(current ?? "widget");
  return MODE_ORDER[(Math.max(0, at) + 1) % MODE_ORDER.length] ?? "ambient";
}

/**
 * Los dos controles que aparecen al pasar el mouse.
 *
 * Reemplazan a `MIN / RESTANTES` porque en 176 px no entran los dos, y con el
 * mouse encima lo que importa son los botones y no recordar que la cifra son
 * minutos.
 *
 * Vencido, pausar no significa nada -la bandeja tambien lo deshabilita- y lo
 * que hace falta es confirmar: `LISTO` en solido de acento, porque es LA
 * accion, igual que en la pantalla grande.
 */
function HoverControls({
  isPaused,
  isElapsed,
  onConfirm,
  onPause,
  onResume,
  onCycleMode,
}: Readonly<{
  isPaused: boolean;
  isElapsed: boolean;
  onConfirm: () => void;
  onPause: () => void;
  onResume: () => void;
  onCycleMode: () => void;
}>) {
  return (
    <div
      className="flex shrink-0 items-center gap-1.5"
      style={{ marginLeft: "auto" }}
    >
      {isElapsed ? (
        <button
          type="button"
          onClick={onConfirm}
          className="cairn-press cairn-solid font-mono"
          style={{
            ...CONTROL,
            padding: "0 10px",
            fontSize: 9,
            letterSpacing: ".16em",
            color: "var(--color-bg)",
            borderColor: "var(--color-ac)",
          }}
        >
          LISTO
        </button>
      ) : (
        <button
          type="button"
          aria-label={isPaused ? "Reanudar" : "Pausar"}
          onClick={isPaused ? onResume : onPause}
          className="cairn-press cairn-ghost"
          style={CONTROL}
        >
          <PauseIcon showPlay={isPaused} />
        </button>
      )}
      <button
        type="button"
        aria-label="Cambiar de modo"
        onClick={onCycleMode}
        className="cairn-press cairn-ghost font-mono"
        style={{
          ...CONTROL,
          padding: "0 8px",
          fontSize: 8,
          letterSpacing: ".16em",
        }}
      >
        MODO
      </button>
    </div>
  );
}

/**
 * El unico icono de la app: dos rectangulos para pausar, un triangulo para
 * reanudar. Se dibujan con bordes y no con un SVG (docs/DESIGN.md §5: la app no
 * usa imagenes).
 */
function PauseIcon({ showPlay }: Readonly<{ showPlay: boolean }>) {
  if (showPlay) {
    return (
      <div
        style={{
          width: 0,
          height: 0,
          borderTop: "5px solid transparent",
          borderBottom: "5px solid transparent",
          borderLeft: "8px solid var(--fg-66)",
        }}
      />
    );
  }
  return (
    <div className="flex gap-1">
      <div style={{ width: 3, height: 10, background: "var(--fg-66)" }} />
      <div style={{ width: 3, height: 10, background: "var(--fg-66)" }} />
    </div>
  );
}

// Vista Widget (etapa 4, docs/DESIGN.md §4 y el handoff "Cairn Widget y
// Ambiente.dc.html" secc. 6a). La ventana mide 176 × 68 px exactos y es
// transparente de verdad (CLAUDE.md §11): este componente pinta una caja que
// ocupa el 100 % de esa ventana.
//
// El widget se ve en `running` y en `paused`, y tambien en `elapsed`: al vencer
// Rust muestra Foco, pero el usuario puede apartarla y volver a elegir Widget
// desde la bandeja. En ese estado la cifra cuenta hacia arriba y el control del
// hover pasa a ser LISTO, que es la unica accion que cierra el ciclo.
export default function Widget() {
  const { snapshot, nowMs, pause, resume, reset } = useTimer();
  const { settings, setDefaultMode } = useSettings();
  const [hovered, setHovered] = useState(false);

  // Ventana de 176px: no hay lugar para un estado de carga, así que no se
  // pinta nada hasta que llega el primer snapshot.
  if (snapshot === null) {
    return null;
  }

  const { phase } = snapshot;
  const isPaused = phase.kind === "paused";
  // Vencido, el widget se ve solo si el usuario aparto Foco y volvio a elegir
  // Widget desde la bandeja. Ahi la cifra tiene que contar HACIA ARRIBA -cuanto
  // llevas de pausa-, igual que el cronometro de Foco: `remainingMs` da 0 y un
  // "0 MIN RESTANTES" clavado es informacion falsa.
  const isElapsed = phase.kind === "elapsed";
  const minutes = isElapsed
    ? Math.floor(elapsedMs(phase, nowMs) / 60_000)
    : Math.ceil(remainingMs(phase, nowMs) / 60_000);
  const progress = cycleProgress(phase, nowMs);
  // El ultimo tramo (punto que respira, hairline mas grueso) es una senal de
  // "se acerca el final" que no aplica en pausa: ahi todo queda congelado y
  // en gris, sin importar en que porcentaje del ciclo se pauso.
  const final = !isPaused && progress >= FINAL_STRETCH;

  const [labelTop, labelBottom] = labelFor(isPaused, isElapsed);

  // LISTO cierra la pausa: reinicia el ciclo Y deja la rutina limpia para la
  // proxima, exactamente igual que el LISTO de Foco. La regla vive en
  // `clearRoutineChecks`, que es el unico lugar donde esta escrita.
  const confirmCycle = () => {
    void reset();
    clearRoutineChecks().catch(console.error);
  };

  // El destino de `MODO` se calcula contra el modo GUARDADO y no contra
  // "widget" fijo: el widget solo se ve en modo widget, pero clavar el destino
  // convertiria el boton en un "ir a Ambiente" disfrazado de MODO.
  const cycleMode = () => void setDefaultMode(nextInWheel(settings?.defaultMode));

  return (
    <div
      // "deep" y no el atributo pelado: la caja esta tapada por sus hijos (la
      // cifra, la etiqueta), y sin "deep" Tauri exige que el click caiga
      // EXACTAMENTE sobre este elemento para poder arrastrar (CLAUDE.md §11).
      data-tauri-drag-region="deep"
      className="cairn-press relative flex h-full w-full items-center"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        boxSizing: "border-box",
        borderRadius: 5,
        // Con el mouse encima el aire se achica: los dos controles ocupan mas
        // que la etiqueta que reemplazan y en 176 px no sobra nada.
        //
        // ponytail: entra comodo hasta dos digitos, que es lo que dan los
        // intervalos del producto (25/45/60/90). Con un intervalo de tres
        // digitos, tipeado a mano en el campo libre, el `overflow` recorta el
        // borde del boton MODO en vez de desbordar la ventana. Si eso llega a
        // molestar, el camino es esconder el boton de pausa -que ya esta en la
        // bandeja-, no achicar la cifra.
        overflow: "hidden",
        padding: hovered ? "0 12px" : "0 18px",
        gap: hovered ? 8 : 11,
        // 62 % en reposo, 82 % en hover (handoff 6a). Sin backdrop-filter: no
        // hay nada detras de una ventana transparente que el webview pueda
        // muestrear, asi que el blur del handoff no hace nada aca. Tampoco la
        // sombra del handoff: es un color hardcodeado que, sobre una ventana
        // transparente, deja un halo cuadrado en vez de una sombra.
        background: hovered ? "var(--bg-82)" : "var(--bg-62)",
        border: `1px solid ${hovered ? "var(--fg-20)" : "var(--fg-10)"}`,
      }}
    >
      <div
        className="font-sans"
        style={{
          fontSize: 38,
          fontWeight: 300,
          lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
          color: isPaused ? "var(--fg-66)" : "var(--color-fg)",
        }}
      >
        {minutes}
      </div>
      {hovered ? (
        <HoverControls
          isPaused={isPaused}
          isElapsed={isElapsed}
          onConfirm={confirmCycle}
          onPause={() => void pause()}
          onResume={() => void resume()}
          onCycleMode={cycleMode}
        />
      ) : (
        <div
          className="font-mono"
          style={{
            fontSize: 9,
            letterSpacing: ".24em",
            lineHeight: 1.8,
            color: isPaused ? "var(--fg-30)" : "var(--fg-42)",
          }}
        >
          {labelTop}
          <br />
          {labelBottom}
        </div>
      )}
      {final && !hovered && (
        <div
          className="cairn-breathe rounded-full"
          style={{
            width: 6,
            height: 6,
            marginLeft: "auto",
            background: "var(--color-ac)",
          }}
        />
      )}
      <div
        className="absolute bottom-0 left-0"
        style={{
          height: final ? 3 : 2,
          width: `${progress * 100}%`,
          borderRadius: "0 2px 2px 0",
          background: hairlineInk(isPaused, final),
        }}
      />
    </div>
  );
}
