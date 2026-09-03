import { renderToStaticMarkup } from "react-dom/server";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { describe, expect, it } from "vitest";
import { countCheckboxes, toggleCheckboxAtLine } from "./routine";
import type { useRoutine } from "./useRoutine";
import Routine, { checkboxOf, localUrl } from "./views/Routine";

// El contrato que ningun compilador puede chequear: que la linea que
// `remark-gfm` reporta para una casilla sea la misma linea que
// `toggleCheckboxAtLine` sabe voltear. Todo el diseno del volteo por numero de
// linea (docs/plans/PLAN-routine.md, decision 1) se apoya en eso.
//
// Si una version futura de `react-markdown` dejara de pasar `node`, o de traer
// `position`, este test se pone rojo. Sin el, la app compilaria igual y los
// clics dejarian de hacer efecto en silencio.

// A proposito incomodo: casillas anidadas, una lista numerada, una cita, un
// item comun sin casilla, y un bloque de codigo con casillas de mentira.
const DOC = `# Rutina

## Cuello

- [ ] Mentón al pecho
- [x] Oreja al hombro
  - [ ] Anidada
- Un item sin casilla

1. [ ] Numerada

\`\`\`md
- [ ] esto es un ejemplo, no una tarea
- [x] esto tampoco
\`\`\`

> Si duele, pará.
`;

/** Renderiza el markdown y devuelve, en orden, lo que remark llama casillas. */
function taskItems(markdown: string): { line: number; checked: boolean }[] {
  const found: { line: number; checked: boolean }[] = [];
  renderToStaticMarkup(
    <Markdown
      remarkPlugins={[remarkGfm]}
      components={{
        li({ node, children }) {
          const box = node && checkboxOf(node);
          if (node?.position && box) {
            found.push({
              line: node.position.start.line,
              checked: box.properties?.checked === true,
            });
          }
          return <li>{children}</li>;
        },
      }}
    >
      {markdown}
    </Markdown>,
  );
  return found;
}

describe("las lineas que reporta remark-gfm", () => {
  const items = taskItems(DOC);

  it("son las cuatro casillas reales, sin las del bloque de codigo", () => {
    expect(items).toEqual([
      { line: 5, checked: false },
      { line: 6, checked: true },
      { line: 7, checked: false },
      { line: 10, checked: false },
    ]);
  });

  it("coinciden con lo que cuenta countCheckboxes", () => {
    expect(countCheckboxes(DOC)).toEqual({
      done: items.filter((item) => item.checked).length,
      total: items.length,
    });
  });

  it("apuntan a lineas que toggleCheckboxAtLine sabe voltear", () => {
    for (const item of items) {
      const flipped = toggleCheckboxAtLine(DOC, item.line);
      expect(flipped, `la linea ${item.line} no se volteo`).not.toBe(DOC);

      // Y voltea exactamente esa: las otras tres quedan como estaban.
      const after = taskItems(flipped);
      expect(after).toEqual(
        items.map((other) =>
          other.line === item.line
            ? { ...other, checked: !other.checked }
            : other,
        ),
      );
    }
  });
});

// La rutina se renderiza a JSX, nunca a HTML crudo, y no puede salir a la red
// (CLAUDE.md §2). Los dos se rompen el dia que alguien agregue `rehype-raw` o
// saque el `urlTransform` "porque las imagenes no se ven".
describe("el renderizado no confia en el markdown", () => {
  function html(markdown: string): string {
    return renderToStaticMarkup(
      <Markdown remarkPlugins={[remarkGfm]} urlTransform={localUrl}>
        {markdown}
      </Markdown>,
    );
  }

  it("muestra el HTML crudo como texto, no como elementos", () => {
    const rendered = html("<script>alert(1)</script>\n");
    expect(rendered).not.toContain("<script");
    expect(rendered).toContain("&lt;script&gt;");
  });

  it("no deja que una imagen remota dispare una peticion", () => {
    expect(html("![p](https://ejemplo.tld/pixel.png)\n")).not.toContain(
      "ejemplo.tld",
    );
  });

  it("bloquea todo esquema absoluto y deja pasar las rutas relativas", () => {
    for (const url of [
      "https://x.tld/a.png",
      "http://x.tld/a.png",
      "data:image/svg+xml,<svg/>",
      "javascript:alert(1)",
      "mailto:a@b.c",
    ]) {
      expect(localUrl(url), url).toBe("");
    }
    for (const url of [
      "laminas/cuello.png",
      "./a.png",
      "/notes/a.png",
      "#ancla",
    ]) {
      expect(localUrl(url), url).toBe(url);
    }
  });
});

// Lista SUELTA: con una linea en blanco entre items, `mdast-util-to-hast` mete
// el `<input>` adentro de un `<p>` en vez de colgarlo directo del `<li>`. Es la
// otra rama de `checkboxOf`, y si se rompiera las casillas dejarian de
// responder sin un solo error en consola.
const LOOSE = `- [ ] uno

- [x] dos
`;

// Anidada: el `<li>` hija va ADENTRO del `<li>` padre. Es la razon por la que
// el clic vive en el boton de la casilla y NO en la fila: con la fila
// escuchando, tocar la hija disparaba tambien al padre y se guardaba el volteo
// equivocado. Si algun dia alguien vuelve a poner un `onClick` en el `<li>`,
// este test es el recordatorio de por que no se puede.
const NESTED = `- [ ] padre
  - [ ] hija
`;

describe("las formas de lista que rompen el panel si nadie las mira", () => {
  it("entrega las casillas de una lista suelta", () => {
    expect(taskItems(LOOSE)).toEqual([
      { line: 1, checked: false },
      { line: 3, checked: true },
    ]);
  });

  it("anida el item hijo adentro del padre", () => {
    const html = renderToStaticMarkup(
      <Markdown remarkPlugins={[remarkGfm]}>{NESTED}</Markdown>,
    );
    const parent = html.indexOf("<li");
    const child = html.indexOf("<li", parent + 1);
    expect(child).toBeGreaterThan(-1);
    expect(child).toBeLessThan(html.indexOf("</li>"));
  });
});

// El corpus incomodo. Cada documento cruza los dos parsers: el de `remark-gfm`,
// que decide QUE SE DIBUJA, y el nuestro, que decide que se voltea y que se
// cuenta. Los dos tienen que coincidir siempre, porque una casilla dibujada que
// no se puede voltear no da error: simplemente no pasa nada al hacerle clic.
//
// Este es el test que encontro la casilla adentro de una cita y la cerca de
// codigo con CRLF; el cruce sobre un solo documento amable las dejaba pasar.
const CORPUS: Record<string, string> = {
  cita: "> - [ ] cuello\n> - [x] hombros\n",
  crlf: "- [x] real\r\n\r\n```md\r\n- [ ] ej\r\n```\r\n\r\n- [ ] otra\r\n",
  pelada: "- [ ]\n- [x] con texto\n",
  anidada: "- [ ] padre\n  - [x] hija\n",
  suelta: LOOSE,
  numerada: "1. [ ] uno\n2. [x] dos\n",
};

// AFUERA a proposito: un bloque de codigo indentado con cuatro espacios. Ahi el
// contador cuenta casillas que remark no dibuja, y no tiene arreglo local sano
// -una linea indentada cuatro espacios es bloque de codigo O casilla nieta
// segun el contexto de lista, y decidirlo es el segundo parser que la decision 1
// del plan existe para no tener-. Solo desincroniza el "N DE M HECHAS", que es
// cosmetico; el volteo no pasa por ahi.

describe.each(Object.entries(CORPUS))(
  "el contador y remark-gfm no se contradicen (%s)",
  (_name, doc) => {
    const items = taskItems(doc);

    it("cuenta lo mismo que remark", () => {
      expect(countCheckboxes(doc)).toEqual({
        done: items.filter((item) => item.checked).length,
        total: items.length,
      });
    });

    it("toda casilla que remark dibuja se puede voltear", () => {
      expect(items.length).toBeGreaterThan(0);
      for (const item of items) {
        expect(
          toggleCheckboxAtLine(doc, item.line),
          `la linea ${item.line} se dibuja como casilla pero no se voltea`,
        ).not.toBe(doc);
      }
    });
  },
);

// Criterio 2 de la spec: el panel muestra el markdown RENDERIZADO, no el fuente
// como texto plano. Es el unico test que pasa por el mapa real de componentes
// de `Routine.tsx` -catorce overrides-; sin el, un `p` que se coma sus hijos
// deja la rutina en blanco y la suite sigue entera en verde.
//
// El panel se puede renderizar sin Tauri porque importa `useRoutine` como
// `import type`: el estado entra por props y nadie llama a `invoke`.
function stubRoutine(source: string): ReturnType<typeof useRoutine> {
  return {
    source,
    modifiedMs: null,
    draft: "",
    mode: "read",
    error: null,
    clearChecks: () => {},
    reload: () => {},
    startEdit: () => {},
    cancelEdit: () => {},
    setDraft: () => {},
    save: () => {},
    toggleLine: () => {},
    reveal: () => {},
  };
}

describe("el panel de rutina", () => {
  const html = renderToStaticMarkup(
    <Routine routine={stubRoutine(DOC)} hidden={false} />,
  );

  it("no muestra la sintaxis de markdown como texto", () => {
    expect(html).not.toContain("# Rutina");
    expect(html).not.toContain("- [ ] Ment");
  });

  it("dibuja un item por casilla mas el item comun", () => {
    expect(html.match(/<li/g)?.length).toBe(5);
  });

  it("dibuja casillas accesibles, marcadas y sin marcar", () => {
    expect(html).toContain('role="checkbox"');
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain('aria-checked="false"');
  });

  it("muestra la cuenta en el encabezado", () => {
    expect(html).toContain("1 DE 4 HECHAS");
  });
});
