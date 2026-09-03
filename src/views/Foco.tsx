import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";
import { countCheckboxes, editedLabel, routineTitle } from "../routine";
import type { MonitorInfo } from "../settings";
import type { Phase } from "../timer";
import { elapsedMs, formatDuration, parseMinutes, remainingMs } from "../timer";
import { useAlertTone } from "../useAlertTone";
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

/** Los saltos del menu del `▾`. Los chicos ya estan en el boton directo. */
const MENU_SNOOZES = [10, 15, 30, 60];

/** Las tres opciones de tema del handoff. El id es lo que se guarda. */
const THEME_OPTIONS = [
  { id: "system", label: "SISTEMA" },
  { id: "light", label: "CLARO" },
  { id: "dark", label: "OSCURO" },
] as const;

/** Las tres tarjetas de MODOS, en el orden del handoff: de menos a mas presente. */
const MODE_OPTIONS = [
  {
    id: "ambient",
    label: "AMBIENTE",
    hint: "Una barra en el borde superior. Nada más.",
  },
  { id: "widget", label: "WIDGET", hint: "Ventana chica siempre encima." },
  { id: "foco", label: "FOCO", hint: "La pantalla entera, todo el tiempo." },
] as const;

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

/**
 * Pastilla de accion. `solid` es la unica accion primaria de la pantalla.
 *
 * `alternate` es la otra etiqueta que este mismo boton puede llegar a mostrar
 * ("ocultar rutina" para el que dice "ver rutina"). Se renderiza invisible
 * debajo de la real para que el ancho de la pastilla sea siempre el de la
 * etiqueta mas larga. No es un detalle: la fila esta centrada, asi que un
 * boton que se ensancha corre a todos los demas, y `LISTO` es la unica accion
 * de la pantalla que **no puede moverse nunca** (docs/DESIGN.md §4). Medir asi
 * -y no con un `minWidth` en pixeles- es lo unico que no se rompe cuando
 * cambia la tipografia o el `letter-spacing`.
 */
function Pill({
  children,
  onClick,
  solid = false,
  active = false,
  disabled = false,
  padding = "12px 20px",
  alternate,
}: Readonly<{
  children: React.ReactNode;
  onClick: () => void;
  solid?: boolean;
  active?: boolean;
  disabled?: boolean;
  padding?: string;
  alternate?: string;
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
      // El fondo sale de la clase y NO de `style`: en linea le ganaria a la
      // regla de hover por especificidad y la pastilla nunca se tiñe.
      className={`cairn-press rounded-full font-mono disabled:opacity-40 ${
        solid ? "cairn-solid" : "cairn-ghost"
      }`}
      style={{
        padding,
        fontSize: 12,
        letterSpacing: solid ? ".14em" : ".06em",
        color: ink,
        border: `1px solid ${edge}`,
      }}
    >
      {alternate === undefined ? (
        children
      ) : (
        <span className="grid">
          <span
            aria-hidden
            className="invisible whitespace-nowrap"
            style={{ gridArea: "1 / 1" }}
          >
            {alternate}
          </span>
          <span className="whitespace-nowrap" style={{ gridArea: "1 / 1" }}>
            {children}
          </span>
        </span>
      )}
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
      aria-pressed={active}
      className={`cairn-press font-mono ${
        active ? "cairn-solid" : "cairn-ghost cairn-edge"
      }`}
      style={{
        padding: "9px 15px",
        fontSize: 11,
        letterSpacing: ".1em",
        color: active ? "var(--color-bg)" : "var(--fg-66)",
        // Longhands y no el shorthand `border`: el color lo pone `.cairn-edge`
        // cuando el chip esta apagado, para que su hover exista.
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: active ? "var(--color-ac)" : undefined,
      }}
    >
      {label}
    </button>
  );
}

/**
 * La pastilla partida `posponer N` + `▾` del handoff, con su menu.
 *
 * El menu abre **hacia arriba** porque la fila de botones esta a 88 px del
 * borde inferior: hacia abajo no entra.
 *
 * El `ref` envuelve la pastilla Y el menu a proposito. Si envolviera solo al
 * menu, el `pointerdown` sobre el `▾` caeria "afuera" y lo cerraria, y el
 * `onClick` que llega despues lo volveria a abrir: el boton dejaria de poder
 * cerrarlo.
 */
function SnoozePill({
  minutes,
  onSnooze,
}: Readonly<{ minutes: number; onSnooze: (minutes?: number) => void }>) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const pick = (value: number) => {
    setOpen(false);
    setCustom("");
    onSnooze(value);
  };

  const submitCustom = () => {
    const parsed = parseMinutes(custom);
    if (parsed !== null) pick(parsed);
  };

  return (
    <div className="relative" ref={box}>
      {open && (
        <div
          className="absolute font-mono"
          style={{
            bottom: "calc(100% + 10px)",
            right: 0,
            minWidth: 176,
            background: "var(--color-bg)",
            border: "1px solid var(--fg-20)",
          }}
        >
          {MENU_SNOOZES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => pick(value)}
              className="cairn-press cairn-ghost block w-full text-left"
              style={{
                padding: "10px 16px",
                fontSize: 11,
                letterSpacing: ".06em",
                color: "var(--fg-66)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              posponer {value}
            </button>
          ))}
          <div style={{ height: 1, background: "var(--fg-10)" }} />
          <div
            className="flex items-center gap-2"
            style={{ padding: "10px 16px" }}
          >
            <input
              type="number"
              min={1}
              value={custom}
              placeholder="—"
              onChange={(event) => setCustom(event.target.value)}
              // Enter y NADA MAS. Con un `onBlur` que confirmara, tipear 3 y
              // despues clickear "posponer 15" pospondria 3: el mousedown
              // saca el foco del campo, el menu se desmonta, y el click sobre
              // la fila nunca llega. Posponer mueve `deadline_ms` -es la unica
              // accion del menu que toca el ciclo-, asi que un disparo por
              // accidente no es cosmetico. Salir sin Enter es cancelar.
              onKeyDown={(event) => {
                if (event.key === "Enter") submitCustom();
              }}
              className="font-mono"
              style={{
                width: 56,
                padding: "7px 8px",
                fontSize: 11,
                background: "transparent",
                color: "var(--color-fg)",
                border: "1px solid var(--fg-18)",
                fontVariantNumeric: "tabular-nums",
              }}
            />
            <span
              style={{
                fontSize: 10,
                letterSpacing: ".2em",
                color: "var(--fg-38)",
              }}
            >
              MIN
            </span>
          </div>
        </div>
      )}
      {/* `overflow-hidden` recorta los dos segmentos contra el radio de la
          pastilla; por eso el menu vive AFUERA de esta caja y no adentro. */}
      <div
        className="flex items-stretch overflow-hidden rounded-full font-mono"
        style={{ border: "1px solid var(--fg-20)", fontSize: 12 }}
      >
        <button
          type="button"
          onClick={() => onSnooze()}
          className="cairn-press cairn-ghost"
          style={{
            padding: "12px 18px",
            letterSpacing: ".06em",
            color: "var(--fg-66)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {/* Reserva dos digitos siempre. La fila esta centrada, asi que si
              esta pastilla se ensancha al pasar el posponer rapido de 5 a 15,
              `LISTO` se corre -y `LISTO` no se mueve nunca (DESIGN.md §4)-. */}
          <span className="grid">
            <span
              aria-hidden
              className="invisible whitespace-nowrap"
              style={{ gridArea: "1 / 1" }}
            >
              posponer 00
            </span>
            <span className="whitespace-nowrap" style={{ gridArea: "1 / 1" }}>
              posponer {minutes}
            </span>
          </span>
        </button>
        <div style={{ width: 1, background: "var(--fg-20)" }} />
        <button
          type="button"
          aria-label="Elegir los minutos a posponer"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className="cairn-press cairn-ghost"
          style={{
            padding: "12px 13px",
            fontSize: 9,
            color: open ? "var(--color-ac)" : "var(--fg-66)",
          }}
        >
          ▾
        </button>
      </div>
    </div>
  );
}

/**
 * El diagrama de 64 × 40 px de cada tarjeta de modo: una ventana en miniatura
 * con la marca del modo donde le toca aparecer.
 *
 * Es la unica forma honesta de explicar tres modos sin tres capturas: la barra
 * arriba, la cajita abajo a la derecha, el circulo en el centro.
 */
function ModeDiagram({ mode }: Readonly<{ mode: string }>) {
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: 64, height: 40, border: "1px solid var(--fg-18)" }}
    >
      {mode === "ambient" && (
        <div
          className="absolute top-0 left-0"
          style={{ width: "62%", height: 3, background: "var(--color-ac)" }}
        />
      )}
      {mode === "widget" && (
        <div
          className="absolute"
          style={{
            right: 6,
            bottom: 6,
            width: 30,
            height: 14,
            borderRadius: 2,
            background: "var(--fg-30)",
            border: "1px solid var(--fg-40)",
          }}
        />
      )}
      {mode === "foco" && (
        <div
          className="rounded-full"
          style={{ width: 22, height: 22, border: "1px solid var(--color-ac)" }}
        />
      )}
    </div>
  );
}

/** Una de las tres tarjetas de MODOS: diagrama, titulo y una linea. */
function ModeCard({
  mode,
  label,
  hint,
  active,
  onClick,
}: Readonly<{
  mode: string;
  label: string;
  hint: string;
  active: boolean;
  onClick: () => void;
}>) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`cairn-press flex flex-1 flex-col gap-4 text-left ${
        active ? "" : "cairn-ghost cairn-edge"
      }`}
      style={{
        padding: 20,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: active ? "var(--color-ac)" : undefined,
        background: active ? "var(--ac-12)" : undefined,
      }}
    >
      <div className="flex items-center justify-center" style={{ height: 52 }}>
        <ModeDiagram mode={mode} />
      </div>
      <div>
        <div
          className="font-mono"
          style={{
            fontSize: 12,
            letterSpacing: ".14em",
            color: active ? "var(--color-ac)" : "var(--fg-66)",
          }}
        >
          {label}
        </div>
        <div
          className="font-mono"
          style={{
            fontSize: 10,
            lineHeight: 1.7,
            color: "var(--fg-38)",
            marginTop: 5,
          }}
        >
          {hint}
        </div>
      </div>
    </button>
  );
}

/** Boton de texto sin radio, para las dos acciones de la fila RUTINA. */
function Action({
  label,
  onClick,
  dim = false,
}: Readonly<{ label: string; onClick: () => void; dim?: boolean }>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cairn-press cairn-ghost font-mono"
      style={{
        padding: "10px 16px",
        fontSize: 11,
        letterSpacing: ".1em",
        color: dim ? "var(--fg-46)" : "var(--fg-66)",
        border: "1px solid var(--fg-20)",
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
        background: on ? "var(--ac-22)" : "transparent",
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
          style={{
            fontSize: 11,
            color: "var(--fg-42)",
            marginTop: 6,
            // La descripcion lleva numeros -"6 PASOS", "EDITADO HACE 3 DIAS"-
            // y todo numero va tabular (CLAUDE.md §5).
            fontVariantNumeric: "tabular-nums",
          }}
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

/**
 * La fila "Pantalla" de MODOS: en que monitor aparecen Foco y Ambiente.
 *
 * Pide la lista por su cuenta en vez de recibirla por props para no volver a
 * meterle estado y condiciones a `Foco`, que ya es la funcion mas larga del
 * archivo.
 *
 * **Con una sola pantalla no se dibuja nada.** Un selector de una opcion no es
 * una eleccion: es ruido que ocupa una fila y hace dudar de si falta algo.
 *
 * ponytail: la lista se pide una vez al montar. Enchufar un monitor con la app
 * abierta no agrega el chip hasta reiniciarla -la geometria si se acomoda sola,
 * porque el chequeo de 1 Hz de Rust la sigue-. Si llega a molestar, el camino
 * es refrescarla al abrir el panel, no un sondeo.
 */
function MonitorRow({
  selected,
  onPick,
}: Readonly<{ selected: string | null; onPick: (name: string) => void }>) {
  const [monitors, setMonitors] = useState<MonitorInfo[]>([]);

  useEffect(() => {
    invoke<MonitorInfo[]>("modes_monitors").then(setMonitors).catch(console.error);
  }, []);

  if (monitors.length < 2) return null;

  // Sin eleccion guardada manda el primario, que es lo mismo que hace Rust.
  const active =
    monitors.find((monitor) => monitor.name === selected) ??
    monitors.find((monitor) => monitor.primary);

  return (
    <Row
      title="Pantalla"
      hint={`DÓNDE APARECEN FOCO Y AMBIENTE${
        active === undefined ? "" : ` · ${active.width}×${active.height}`
      }`}
    >
      {monitors.map((monitor, index) => (
        <Chip
          key={monitor.name}
          // El ordinal y no el nombre: `\\.\DISPLAY1` no le dice nada a nadie,
          // y el numero es el mismo que muestra Windows en su panel de
          // pantallas, asi que el usuario ya sabe cual es cual.
          label={String(index + 1)}
          active={monitor.name === active?.name}
          onClick={() => onPick(monitor.name)}
        />
      ))}
    </Row>
  );
}

/**
 * El bloque del cronometro: sobre-linea, cifra y marca de respiracion.
 *
 * Es una unidad en `docs/DESIGN.md` §4 -"el bloque del cronometro va centrado
 * con el panel cerrado"- y aca es un componente por el mismo motivo: los
 * cuatro estados que lo mueven al abrirse un panel son suyos y de nadie mas.
 *
 * Con el panel CERRADO va centrado en la ventana, que es donde esta el halo: si
 * el cronometro se queda arriba y el halo en el medio, la pantalla se parte en
 * dos mitades que no se hablan. Los 130 px son la mitad del alto del bloque
 * (sobre-linea + cronometro de 196 px + INHALAR), asi que
 * `calc(50vh - 130px)` lo deja con su centro optico en el centro de la ventana.
 * Al abrirse un panel sube a 58 px, apenas debajo de la sobre-linea.
 *
 * La fila de botones NO cuelga de aca (docs/DESIGN.md §4): esta anclada al pie,
 * porque encoger el cronometro la moveria y `LISTO` no se mueve nunca.
 *
 * `pointer-events-none`: el bloque no tiene nada interactivo, y abierto su alto
 * -que incluye los huecos reservados de la sobre-linea y de INHALAR, invisibles
 * pero presentes- pasa los 172 px donde empieza el panel. Sin esto se comeria
 * los clicks de EDITAR.
 */
function ClockBlock({
  clock,
  overline,
  panelOpen,
  breathing,
}: Readonly<{
  clock: string;
  overline: string;
  panelOpen: boolean;
  /** La marca de respiracion solo tiene sentido durante la pausa. */
  breathing: boolean;
}>) {
  return (
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
      {/* El hueco de la marca se reserva siempre, este visible o no. */}
      <div
        className="cairn-fade flex items-center gap-3.5 font-mono"
        style={{
          marginTop: 20,
          fontSize: 10,
          letterSpacing: ".3em",
          color: "var(--fg-34)",
          opacity: breathing && !panelOpen ? 1 : 0,
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
  const {
    settings,
    setAutostart,
    setTheme,
    setSound,
    setDefaultMode,
    setMonitor,
  } = useSettings();
  const routine = useRoutine();
  const [showSettings, setShowSettings] = useState(false);
  const [showRoutine, setShowRoutine] = useState(false);
  const [customMinutes, setCustomMinutes] = useState("");

  // El tono del aviso. Toda la logica -y su estado- viven en el hook: aca solo
  // se le pasan las dos cosas de las que depende.
  useAlertTone(snapshot?.phase.kind, settings?.soundOnAlert ?? false);

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

  // La etiqueta de arriba es el NOMBRE DEL DOCUMENTO de rutina, como la dibuja
  // el handoff ("CORRECCIÓN DE POSTURA"): la pantalla dice para que es la
  // pausa, no cuanto dura el ciclo. Si el documento no tiene titulo -o todavia
  // no se leyo- cae al intervalo, que es el otro dato que identifica al ciclo.
  const title = routine.source === null ? null : routineTitle(routine.source);
  const label = title?.toUpperCase() ?? `CICLO DE ${intervalMin} MIN`;

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
      <Overline>{showSettings ? "AJUSTES" : label}</Overline>

      <ClockBlock
        clock={clock}
        overline={overline}
        panelOpen={panelOpen}
        breathing={isElapsed}
      />

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

          <Section title="MODOS">
            <div style={{ paddingTop: 24 }}>
              <div style={{ fontSize: 23, fontWeight: 300 }}>
                Modo por defecto
              </div>
              <div
                className="font-mono"
                style={{ fontSize: 11, color: "var(--fg-42)", marginTop: 6 }}
              >
                CÓMO SE MUESTRA CAIRN MIENTRAS CORRE EL CICLO · ELEGIR UNO LO
                CAMBIA AHORA MISMO
              </div>
              {/* Elegir acá conmuta de verdad, no solo escribe el archivo:
                  `default_mode` significa a la vez "el modo elegido" y "con
                  cual arranca". Si el ciclo esta vencido no se ve el cambio,
                  porque vencido siempre manda Foco. */}
              <div className="flex gap-3" style={{ marginTop: 20 }}>
                {MODE_OPTIONS.map((option) => (
                  <ModeCard
                    key={option.id}
                    mode={option.id}
                    label={option.label}
                    hint={option.hint}
                    active={settings?.defaultMode === option.id}
                    onClick={() => void setDefaultMode(option.id)}
                  />
                ))}
              </div>
            </div>
            <MonitorRow
              selected={settings?.monitor ?? null}
              onPick={(name) => void setMonitor(name)}
            />
          </Section>

          <Section title="RUTINA">
            <Row
              title={title ?? "routine.md"}
              hint={[
                `${routine.source === null ? 0 : countCheckboxes(routine.source).total} PASOS`,
                "MARKDOWN",
                editedLabel(routine.modifiedMs, nowMs)?.toUpperCase(),
              ]
                .filter((part) => part !== undefined)
                .join(" · ")}
            >
              <Action
                label="EDITAR"
                onClick={() => {
                  setShowSettings(false);
                  setShowRoutine(true);
                  routine.startEdit();
                }}
              />
              <Action dim label="ABRIR CARPETA" onClick={routine.reveal} />
            </Row>
          </Section>

          <Section title="APARIENCIA">
            <Row
              title="Tema"
              hint="AMBIENTE ELIGE SU TINTA SEGÚN EL FONDO DE CADA VENTANA"
            >
              {THEME_OPTIONS.map((option) => (
                <Chip
                  key={option.id}
                  label={option.label}
                  active={(settings?.theme ?? "dark") === option.id}
                  onClick={() => void setTheme(option.id)}
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
            <div style={{ height: 1, background: "var(--fg-10)" }} />
            <Row
              title="Sonido al avisar"
              hint="UN TONO CORTO Y GRAVE AL VENCER EL CICLO"
            >
              <Switch
                label="Sonido al avisar"
                on={settings?.soundOnAlert ?? false}
                onChange={(next) => void setSound(next)}
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
        <SnoozePill
          minutes={snoozeMin}
          onSnooze={(minutes) => void snooze(minutes)}
        />
        <Pill
          alternate="reanudar"
          onClick={() => void (isPaused ? resume() : pause())}
          disabled={isElapsed}
        >
          {isPaused ? "reanudar" : "pausar"}
        </Pill>
        <Pill
          alternate="ocultar rutina"
          active={showRoutine}
          onClick={toggleRoutine}
        >
          {showRoutine ? "ocultar rutina" : "ver rutina"}
        </Pill>
        <Pill alternate="ajustes" onClick={toggleSettings}>
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
