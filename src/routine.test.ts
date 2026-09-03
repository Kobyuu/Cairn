import { describe, expect, it } from "vitest";
import { countCheckboxes, toggleCheckboxAtLine, uncheckAll } from "./routine";

// La rutina es contenido que Manu escribio a mano: la unica forma de perderla
// es que una de estas funciones toque un byte que no le corresponde. Por eso
// casi todos los tests de aca abajo comparan el documento ENTERO, no la linea.

const DOC = `# Corrección de postura

## Cuello

- [ ] Mentón al pecho
- [x] Oreja al hombro

> Si duele, pará.
`;

describe("toggleCheckboxAtLine", () => {
  it("marca la casilla de la linea pedida y solo esa", () => {
    expect(toggleCheckboxAtLine(DOC, 5)).toBe(
      DOC.replace("- [ ] Mentón", "- [x] Mentón"),
    );
  });

  it("desmarca una casilla ya marcada", () => {
    expect(toggleCheckboxAtLine(DOC, 6)).toBe(
      DOC.replace("- [x] Oreja", "- [ ] Oreja"),
    );
  });

  it("preserva el salto de linea final", () => {
    // Perder el `\n` del final en cada guardado es como un archivo se ensucia
    // de a poco: el diff de git deja de tener sentido y los editores se quejan.
    expect(toggleCheckboxAtLine(DOC, 5).endsWith("\n")).toBe(true);
    expect(toggleCheckboxAtLine("- [ ] sin salto final", 1)).toBe(
      "- [x] sin salto final",
    );
  });

  it("respeta la indentacion de las casillas anidadas", () => {
    const nested = "- [ ] padre\n  - [ ] hija\n";
    expect(toggleCheckboxAtLine(nested, 2)).toBe("- [ ] padre\n  - [x] hija\n");
  });

  it("acepta los tres marcadores de lista y las listas numeradas", () => {
    expect(toggleCheckboxAtLine("* [ ] a\n", 1)).toBe("* [x] a\n");
    expect(toggleCheckboxAtLine("+ [ ] a\n", 1)).toBe("+ [x] a\n");
    expect(toggleCheckboxAtLine("1. [ ] a\n", 1)).toBe("1. [x] a\n");
  });

  it("trata la X mayuscula como marcada y la normaliza a minuscula", () => {
    expect(toggleCheckboxAtLine("- [X] a\n", 1)).toBe("- [ ] a\n");
  });

  it("voltea una casilla adentro de una cita", () => {
    // `> - [ ] x` es una tarea de verdad para remark-gfm: dibuja la casilla y
    // reporta su linea. Si el volteo no la reconoce, el clic no hace nada y no
    // hay un solo error en ninguna parte.
    const quoted = "> - [ ] cuello\n> - [x] hombros\n";
    expect(toggleCheckboxAtLine(quoted, 1)).toBe(
      "> - [x] cuello\n> - [x] hombros\n",
    );
    expect(toggleCheckboxAtLine(quoted, 2)).toBe(
      "> - [ ] cuello\n> - [ ] hombros\n",
    );
  });

  it("no toca un `- [ ]` sin texto, que para GFM no es una tarea", () => {
    expect(toggleCheckboxAtLine("- [ ]\n", 1)).toBe("- [ ]\n");
  });

  it("devuelve el documento intacto si la linea no tiene una casilla", () => {
    // La guarda que hace estructuralmente imposible el bug del `- [x]` adentro
    // de un bloque de codigo: remark decide que es una casilla y nos pasa SU
    // linea, y encima de eso la funcion se niega a tocar una linea que no lo es.
    for (const line of [1, 2, 3, 4, 7, 8]) {
      expect(toggleCheckboxAtLine(DOC, line)).toBe(DOC);
    }
  });

  it("no lanza ni cambia nada con una linea fuera de rango", () => {
    for (const line of [0, -3, 99, 1.5, Number.NaN]) {
      expect(toggleCheckboxAtLine(DOC, line)).toBe(DOC);
    }
  });

  it("no confunde un corchete que aparece mas adelante en la linea", () => {
    const doc = "texto suelto con - [ ] adentro\n";
    expect(toggleCheckboxAtLine(doc, 1)).toBe(doc);
  });

  it("no toca un guion sin casilla", () => {
    expect(toggleCheckboxAtLine("- item comun\n", 1)).toBe("- item comun\n");
  });

  it("preserva los finales de linea de Windows", () => {
    // El Bloc de Notas guarda con CRLF. Si el volteo se comiera el `\r`, el
    // archivo quedaria con finales de linea mezclados despues del primer clic.
    const crlf = "- [ ] a\r\n- [ ] b\r\n";
    expect(toggleCheckboxAtLine(crlf, 2)).toBe("- [ ] a\r\n- [x] b\r\n");
  });
});

describe("countCheckboxes", () => {
  it("cuenta las hechas y el total", () => {
    expect(countCheckboxes(DOC)).toEqual({ done: 1, total: 2 });
  });

  it("no cuenta lineas que no son casillas", () => {
    expect(countCheckboxes("# titulo\n- item\ntexto\n")).toEqual({
      done: 0,
      total: 0,
    });
  });

  it("no cuenta las casillas de un bloque de codigo", () => {
    // Aca si hace falta rastrear las cercas: el contador no recibe lineas de
    // remark, mira el fuente entero.
    const doc = "- [x] real\n\n```md\n- [ ] ejemplo\n- [x] ejemplo\n```\n";
    expect(countCheckboxes(doc)).toEqual({ done: 1, total: 1 });
  });

  it("cierra el bloque de codigo con la misma cerca con la que abrio", () => {
    const doc = "~~~\n- [ ] adentro\n~~~\n- [ ] afuera\n";
    expect(countCheckboxes(doc)).toEqual({ done: 0, total: 1 });
  });

  it("reconoce una cerca con info string en un archivo con CRLF", () => {
    // El Bloc de Notas guarda CRLF, y la checklist manual dice explicitamente
    // de editar la rutina desde ahi. Sin pelar el `\r`, la cerca de apertura
    // ```md no matchea, se cuentan las casillas del ejemplo, y la de cierre
    // abre un bloque que nunca termina y se come las casillas reales de abajo.
    const doc =
      "- [x] real\r\n\r\n```md\r\n- [ ] ejemplo\r\n```\r\n\r\n- [ ] otra real\r\n";
    expect(countCheckboxes(doc)).toEqual({ done: 1, total: 2 });
  });

  it("cuenta las casillas de una cita", () => {
    expect(countCheckboxes("> - [ ] a\n> - [x] b\n")).toEqual({
      done: 1,
      total: 2,
    });
  });

  it("un documento vacio no tiene casillas", () => {
    expect(countCheckboxes("")).toEqual({ done: 0, total: 0 });
  });
});

describe("uncheckAll", () => {
  it("desmarca todo y deja el resto del documento intacto", () => {
    const marcado = DOC.replace("- [ ] Mentón", "- [x] Mentón");
    expect(uncheckAll(marcado)).toBe(DOC.replace("- [x] Oreja", "- [ ] Oreja"));
  });

  it("devuelve la MISMA cadena si no habia nada marcado", () => {
    // Quien llama se apoya en esto para saltearse la escritura a disco: apretar
    // LISTO con la rutina ya limpia no puede tocar el archivo.
    const limpio = "- [ ] a\n- [ ] b\n";
    expect(uncheckAll(limpio)).toBe(limpio);
  });

  it("no toca las casillas de un bloque de codigo", () => {
    const doc = "- [x] real\n\n```md\n- [x] ejemplo\n```\n";
    expect(uncheckAll(doc)).toBe("- [ ] real\n\n```md\n- [x] ejemplo\n```\n");
  });

  it("preserva los finales de linea de Windows", () => {
    expect(uncheckAll("- [x] a\r\n- [x] b\r\n")).toBe("- [ ] a\r\n- [ ] b\r\n");
  });

  it("desmarca adentro de citas y de listas anidadas", () => {
    expect(uncheckAll("> - [x] cita\n  - [x] hija\n")).toBe(
      "> - [ ] cita\n  - [ ] hija\n",
    );
  });

  it("un documento sin casillas vuelve tal cual", () => {
    const doc = "# titulo\n\ntexto suelto\n";
    expect(uncheckAll(doc)).toBe(doc);
  });
});
