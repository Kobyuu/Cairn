import { useMemo, useRef } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { countCheckboxes } from "../routine";
import type { useRoutine } from "../useRoutine";

// Panel de rutina, adentro de Foco (docs/DESIGN.md §4, handoff "Cairn Rutina").
// Dos estados: lectura -el markdown renderizado, con casillas que se marcan- y
// edicion -un `<textarea>` con el fuente crudo-. Nada de editor WYSIWYG
// (SPEC-routine.md §Limites).

/**
 * El nodo de hast que `react-markdown` le pasa a cada componente. Se declara
 * aca en vez de importarlo de `hast` porque `@types/hast` no es una dependencia
 * directa nuestra; es la forma minima que realmente se lee.
 */
export interface HastNode {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
  position?: { start: { line: number } };
}

/**
 * Busca la casilla que `remark-gfm` mete adentro de un item de tarea.
 *
 * Devuelve `undefined` para un item de lista comun, que es como se distingue
 * una tarea de un bullet. El `<input>` aparece como primer hijo del `<li>` en
 * una lista compacta y adentro del `<p>` en una suelta, asi que se miran los
 * dos niveles. Verificado contra el handler `listItem` de `mdast-util-to-hast`.
 */
export function checkboxOf(node: HastNode): HastNode | undefined {
  for (const child of node.children ?? []) {
    if (child.type !== "element") continue;
    if (child.tagName === "input") return child;
    if (child.tagName === "p") {
      const nested = checkboxOf(child);
      if (nested) return nested;
    }
  }
  return undefined;
}

/**
 * Deja pasar solo URLs relativas: **Cairn no hace red** (CLAUDE.md §2).
 *
 * El saneamiento que trae `react-markdown` permite `http(s)`, que es lo
 * correcto para una app con backend y un permiso de mas para esta. Sin esto,
 * pegar en `routine.md` una rutina copiada de cualquier lado -con un pixel de
 * seguimiento adentro- manda la IP, el user agent y la hora exacta en que Manu
 * abre el panel a un tercero, sin un solo aviso. La URL vacia bloquea.
 */
export function localUrl(url: string): string {
  return /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(url) ? "" : url;
}

const HEADER_LABEL = {
  fontSize: 10,
  letterSpacing: ".26em",
  color: "var(--fg-40)",
} as const;

/** Pastilla del encabezado del panel: EDITAR, GUARDAR, CANCELAR. */
function PanelButton({
  children,
  onClick,
  solid = false,
  dim = false,
  disabled = false,
}: Readonly<{
  children: string;
  onClick: () => void;
  solid?: boolean;
  dim?: boolean;
  disabled?: boolean;
}>) {
  // CANCELAR va mas apagada que EDITAR: es la salida, no la accion.
  let ink = "var(--fg-66)";
  if (solid) ink = "var(--color-bg)";
  else if (dim) ink = "var(--fg-46)";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="cairn-press rounded-full font-mono disabled:opacity-40"
      style={{
        padding: solid ? "8px 16px" : "8px 14px",
        fontSize: 11,
        letterSpacing: ".1em",
        background: solid ? "var(--color-ac)" : "transparent",
        color: ink,
        border: solid ? "1px solid var(--color-ac)" : "1px solid var(--fg-20)",
      }}
    >
      {children}
    </button>
  );
}

type Children = Readonly<{ children?: React.ReactNode }>;

export interface MarkdownItemProps {
  node?: HastNode;
  children?: React.ReactNode;
}

/**
 * Un item de lista de la rutina: tarea con casilla, o bullet comun.
 *
 * El clic vive en el `<button>` de la casilla y **no** en la fila entera, y esa
 * es una decision con dos motivos que se refuerzan:
 *
 * 1. `remark-gfm` anida el `<li>` hijo ADENTRO del padre. Con la fila
 *    escuchando, tocar una casilla indentada disparaba los dos handlers con el
 *    mismo `source` viejo: se marcaba el padre y no la hija, y eso se guardaba.
 * 2. Un `<li>` con `onClick` es un elemento no interactivo con un manejador de
 *    mouse: invisible para el teclado y para un lector de pantalla.
 *
 * Con el clic en el boton, las dos cosas se arreglan solas y no hay nada que
 * frenar en la propagacion.
 */
function MarkdownItem({
  node,
  children,
  onToggle,
}: Readonly<MarkdownItemProps & { onToggle: (line: number) => void }>) {
  const box = node && checkboxOf(node);
  const line = node?.position?.start.line;
  const task =
    box && line ? { done: box.properties?.checked === true, line } : null;

  let color = "var(--fg-66)";
  if (task) color = task.done ? "var(--fg-34)" : "var(--color-fg)";

  return (
    <li
      style={{
        position: "relative",
        paddingLeft: 44,
        marginTop: 26,
        fontSize: task ? 27 : 21,
        fontWeight: 300,
        lineHeight: 1.5,
        color,
        textDecoration: task?.done ? "line-through" : undefined,
        textWrap: "pretty",
      }}
    >
      {task ? (
        // La casilla se dibuja aca y no en el componente de `input` porque el
        // `<input>` que emite `remark-gfm` es un nodo SINTETICO: no viene del
        // fuente, asi que no trae `position` y no sabria a que linea pertenece.
        // El `<li>` si.
        //
        // Es un `<button role="checkbox">` y no un `<input type="checkbox">`
        // -que seria lo primero que uno elige- porque la casilla del handoff es
        // un cuadrado de 26 px con un ✓ en Mono, y pintar eso sobre un input
        // nativo pide un `appearance:none` mas un glifo en un pseudo-elemento,
        // que no se puede escribir en un estilo en linea sin hardcodear un
        // color (CLAUDE.md §5). El patron ARIA es valido y el teclado funciona.
        <button
          type="button"
          role="checkbox"
          aria-checked={task.done}
          onClick={() => onToggle(task.line)}
          className="cairn-press"
          style={{
            position: "absolute",
            left: 0,
            top: 5,
            width: 26,
            height: 26,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            color: "var(--color-bg)",
            background: task.done ? "var(--color-ac)" : "transparent",
            border: `1px solid ${task.done ? "var(--color-ac)" : "var(--fg-26)"}`,
          }}
        >
          {task.done ? "✓" : ""}
        </button>
      ) : (
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: 26,
            top: 0,
            color: "var(--fg-38)",
          }}
        >
          ·
        </span>
      )}
      {children}
    </li>
  );
}

/**
 * Todo lo que se renderiza igual sin importar el estado del panel.
 *
 * Vive en el modulo y no adentro de `Routine` para que sea UN objeto y no uno
 * nuevo por render, y para que cada override sea un componente de verdad en vez
 * de una funcion redefinida en cada pintado.
 */
const STATIC_COMPONENTS = {
  h1: ({ children }: Children) => (
    <div style={{ fontSize: 34, fontWeight: 300, lineHeight: 1.2 }}>
      {children}
    </div>
  ),
  // Los `##` son las secciones de la rutina: van en Mono, no en la serif.
  h2: ({ children }: Children) => (
    <div
      className="font-mono"
      style={{
        fontSize: 14,
        letterSpacing: ".26em",
        textTransform: "uppercase",
        color: "var(--fg-40)",
        marginTop: 12,
      }}
    >
      {children}
    </div>
  ),
  h3: ({ children }: Children) => (
    <div
      className="font-mono"
      style={{
        fontSize: 11,
        letterSpacing: ".2em",
        color: "var(--fg-30)",
        marginTop: 8,
      }}
    >
      {children}
    </div>
  ),
  p: ({ children }: Children) => (
    <p
      style={{
        fontSize: 19,
        fontWeight: 300,
        lineHeight: 1.6,
        color: "var(--fg-66)",
      }}
    >
      {children}
    </p>
  ),
  // Nada en negrita (docs/DESIGN.md §3): el enfasis fuerte se marca con tinta
  // plena contra el 66 % del cuerpo, no con un peso mas grueso.
  strong: ({ children }: Children) => (
    <span style={{ color: "var(--color-fg)" }}>{children}</span>
  ),
  blockquote: ({ children }: Children) => (
    <div
      style={{
        fontStyle: "italic",
        fontSize: 20,
        lineHeight: 1.6,
        color: "var(--fg-46)",
        paddingLeft: 44,
        borderLeft: "1px solid var(--fg-16)",
      }}
    >
      {children}
    </div>
  ),
  ul: ({ children }: Children) => (
    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>{children}</ul>
  ),
  ol: ({ children }: Children) => (
    <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>{children}</ol>
  ),
  // El `<input type=checkbox disabled>` de `remark-gfm` no se pinta: lo
  // reemplaza el boton de `MarkdownItem`, que si responde al teclado.
  input: () => null,
  hr: () => <div style={{ height: 1, background: "var(--fg-12)" }} />,
  code: ({ children }: Children) => (
    <code className="font-mono" style={{ fontSize: 14, color: "var(--fg-66)" }}>
      {children}
    </code>
  ),
  pre: ({ children }: Children) => (
    <pre
      style={{
        margin: 0,
        padding: "14px 16px",
        overflowX: "auto",
        border: "1px solid var(--fg-12)",
        background: "var(--fg-3)",
        lineHeight: 1.7,
      }}
    >
      {children}
    </pre>
  ),
  // Un `<a>` de verdad navegaria la ventana de Foco a otra pagina y la app
  // quedaria fuera de su propio index.html, sin forma de volver. Hasta que haya
  // un abridor externo, un enlace se ve pero no navega.
  a: ({ children, href }: Children & { href?: string }) => (
    <span title={href} style={{ color: "var(--color-ac)" }}>
      {children}
    </span>
  ),
  // Sin `src` -o con uno que `localUrl` vacio- no se pinta un `<img>`: un
  // `src=""` hace que el navegador vuelva a pedir la pagina actual y dibuje el
  // icono de imagen rota. Se muestra el texto alternativo.
  img: ({ src, alt }: { src?: string; alt?: string }) =>
    src ? (
      <span
        style={{
          display: "block",
          border: "1px solid var(--fg-30)",
          padding: 9,
        }}
      >
        <img src={src} alt={alt} style={{ display: "block", width: "100%" }} />
      </span>
    ) : (
      <span
        className="font-mono"
        style={{ fontSize: 11, color: "var(--fg-38)" }}
      >
        {alt ?? "IMAGEN"}
      </span>
    ),
};

export default function Routine({
  routine,
  hidden,
}: Readonly<{ routine: ReturnType<typeof useRoutine>; hidden: boolean }>) {
  const {
    source,
    draft,
    mode,
    error,
    startEdit,
    cancelEdit,
    setDraft,
    save,
    toggleLine,
  } = routine;
  const gutter = useRef<HTMLDivElement>(null);

  // Solo el item de lista necesita saber que hacer con un clic, asi que es lo
  // unico que se memoriza. El resto del mapa es estatico y vive afuera: un
  // objeto nuevo en cada tick del cronometro -Foco repinta una vez por
  // segundo- haria que react-markdown reconstruya el arbol entero.
  const components = useMemo(
    () => ({
      ...STATIC_COMPONENTS,
      li: (props: MarkdownItemProps) => (
        <MarkdownItem {...props} onToggle={toggleLine} />
      ),
    }),
    [toggleLine],
  );

  // El markdown se parsea una sola vez por contenido. Sin esto se volveria a
  // parsear en cada tick del cronometro, porque Foco repinta una vez por
  // segundo y el panel cuelga de Foco.
  const rendered = useMemo(
    () =>
      source === null ? null : (
        <Markdown
          remarkPlugins={[remarkGfm]}
          components={components}
          urlTransform={localUrl}
        >
          {source}
        </Markdown>
      ),
    [source, components],
  );

  const counts = countCheckboxes(source ?? "");
  const editing = mode === "edit";
  const lineCount = draft.split("\n").length;
  const meta = editing
    ? `MARKDOWN · ${lineCount} ${lineCount === 1 ? "LÍNEA" : "LÍNEAS"}`
    : `${counts.done} DE ${counts.total} HECHAS`;

  return (
    <div
      style={{
        width: 860,
        maxWidth: "calc(100vw - 160px)",
        display: hidden ? "none" : "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      <div
        className="flex flex-none items-center gap-4 font-mono"
        style={{ paddingBottom: 16, borderBottom: "1px solid var(--fg-14)" }}
      >
        <div style={HEADER_LABEL}>
          {editing ? "EDITANDO LA RUTINA" : "RUTINA"}
        </div>
        <div
          style={{
            fontSize: 10,
            letterSpacing: ".2em",
            color: "var(--fg-24)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {meta}
        </div>
        <div className="ml-auto flex gap-2">
          {editing ? (
            <>
              <PanelButton solid onClick={save}>
                GUARDAR
              </PanelButton>
              <PanelButton dim onClick={cancelEdit}>
                CANCELAR
              </PanelButton>
            </>
          ) : (
            // Sin rutina leida no se puede editar: el textarea arrancaria
            // vacio y GUARDAR pisaria el archivo con una cadena vacia. Pasa de
            // verdad si la lectura todavia esta en vuelo, o si fallo.
            <PanelButton onClick={startEdit} disabled={source === null}>
              EDITAR
            </PanelButton>
          )}
        </div>
      </div>

      {error !== null && (
        <div
          className="flex-none font-mono"
          style={{ fontSize: 11, color: "var(--color-ac)", paddingTop: 12 }}
        >
          {error}
        </div>
      )}

      {editing ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div
            className="flex min-h-0 flex-1"
            style={{
              marginTop: 22,
              border: "1px solid var(--fg-16)",
              background: "var(--fg-3)",
            }}
          >
            {/* La canaleta de numeros no scrollea sola: la sincroniza el
                textarea, que es el unico que sabe cuanto se movio. */}
            <div
              ref={gutter}
              aria-hidden
              className="flex-none overflow-hidden font-mono"
              style={{
                width: 52,
                borderRight: "1px solid var(--fg-12)",
                padding: "22px 0",
                fontSize: 12,
                lineHeight: 2.1,
                textAlign: "right",
                color: "var(--fg-22)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {Array.from({ length: lineCount }, (_, index) => (
                <div key={index} style={{ paddingRight: 14 }}>
                  {index + 1}
                </div>
              ))}
            </div>
            <textarea
              value={draft}
              spellCheck={false}
              autoFocus
              onChange={(event) => setDraft(event.target.value)}
              onScroll={(event) => {
                if (gutter.current)
                  gutter.current.scrollTop = event.currentTarget.scrollTop;
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") cancelEdit();
                if (event.key.toLowerCase() === "s" && event.ctrlKey) {
                  event.preventDefault();
                  save();
                }
              }}
              className="min-w-0 flex-1 font-mono"
              style={{
                background: "transparent",
                border: "none",
                outline: "none",
                resize: "none",
                padding: "22px 26px",
                fontSize: 15,
                lineHeight: 2.1,
                color: "var(--color-fg)",
                caretColor: "var(--color-ac)",
              }}
            />
          </div>
          <div
            className="flex flex-none items-center gap-5 font-mono"
            style={{
              paddingTop: 14,
              fontSize: 10,
              letterSpacing: ".2em",
              color: "var(--fg-30)",
            }}
          >
            <div>MARKDOWN · # TÍTULO · - LISTA · - [ ] CASILLA</div>
            <div className="ml-auto">CTRL+S GUARDAR · ESC CANCELAR</div>
          </div>
        </div>
      ) : (
        <div
          className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto"
          style={{ padding: "24px 4px" }}
        >
          {source === null ? (
            <div
              className="font-mono"
              style={{
                fontSize: 10,
                letterSpacing: ".3em",
                color: "var(--fg-38)",
              }}
            >
              LEYENDO
            </div>
          ) : (
            rendered
          )}
        </div>
      )}
    </div>
  );
}
