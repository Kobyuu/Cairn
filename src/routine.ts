// Las dos funciones puras de la rutina. Trabajan sobre el markdown fuente, que
// es lo que termina en `notes/routine.md`: lo que se guarda es exactamente lo
// que Manu ve si abre el archivo con el Bloc de Notas.
//
// Por que el volteo va por NUMERO DE LINEA y no por indice de casilla
// (docs/plans/PLAN-routine.md, decision 1): el indice obliga a mantener dos
// parsers que tienen que coincidir -el de `remark-gfm`, que decide que es una
// casilla en la vista renderizada, y uno propio que las cuenta en el fuente- y
// en cuanto discrepan el usuario marca una casilla y se voltea otra. La linea
// la aporta el propio `remark-gfm` (`node.position.start.line`), asi que el que
// decide es uno solo.

/**
 * Una casilla al principio de una linea: prefijos de cita, sangria, marcador de
 * lista, `[ ]` o `[x]`, y **espacio** despues del corchete. Los tres grupos
 * parten la linea en "lo de antes", "el estado" y "lo de despues", para poder
 * reescribir un solo caracter.
 *
 * Los dos detalles finos valen su tinta porque los dos se descubrieron rompiendo:
 *
 * - `(?:\s*>)*` — una casilla adentro de una cita (`> - [ ] cuello`) es una
 *   tarea de verdad para `remark-gfm`: la dibuja y reporta su linea. Sin este
 *   prefijo la casilla se veia, se podia hacer clic, y no pasaba **nada** -sin
 *   error y sin log-, que es la peor forma de fallar.
 * - `(?=\s)` y no `(?=\s|$)` — un `- [ ]` sin texto no es una tarea para GFM.
 *   Aceptarla desincronizaba el contador del encabezado contra lo dibujado.
 */
const CHECKBOX = /^((?:\s*>)*\s*(?:[-*+]|\d{1,9}[.)])\s+\[)([ xX])(\](?=\s))/;

/**
 * Cerca de bloque de codigo: tres o mas backticks o tildes.
 *
 * Es una aproximacion deliberada, no un parser de CommonMark: no exige que la
 * cerca de cierre sea igual o mas larga que la de apertura, y no rastrea cercas
 * indentadas adentro de un item de lista. El techo esta acotado a proposito:
 * esto solo alimenta el "N DE M HECHAS" del encabezado. El volteo, que es lo
 * que escribe el archivo, no pasa por aca -la linea la decide `remark-gfm`-.
 */
const FENCE = /^ {0,3}(`{3,}|~{3,})/;

/**
 * El estado de cerca DESPUES de leer `line`, o `undefined` si la linea no abre
 * ni cierra un bloque -o sea, si es contenido-.
 *
 * Vive aparte del recorrido porque es la unica parte que tiene estado, y
 * mezclada adentro del bucle convertia al escaner en una madeja de tres niveles
 * de `if` con dos `continue` distintos.
 */
function fenceAfter(
  line: string,
  fence: string | null,
): string | null | undefined {
  const match = FENCE.exec(line);
  if (!match) return undefined;

  const marker = (match[1] ?? "").charAt(0);
  // Abre. El info string (```md) solo existe en la cerca de apertura.
  if (fence === null) return marker;
  // Cierra solo si es del mismo caracter y no trae info string. Una cerca de
  // otro caracter adentro de un bloque es texto, no un cierre.
  //
  // Lo que sigue a la cerca se corta de la linea en vez de capturarlo con un
  // `(.*)$`: un segundo cuantificador que puede comerse los mismos caracteres
  // que el primero deja al motor de expresiones con caminos que probar de mas.
  if (marker === fence && line.slice(match[0].length).trim() === "") {
    return null;
  }
  return undefined;
}

/**
 * Voltea la casilla de `line` (1-based) y devuelve el documento completo.
 *
 * Devuelve el markdown **sin tocar** -la misma cadena, no una copia- si la
 * linea no existe, no es un entero, o no empieza con una casilla. Esa ultima
 * guarda es la que hace imposible el bug clasico: un `- [x]` adentro de un
 * bloque de codigo nunca llega aca porque remark no lo considera una casilla,
 * y si llegara igual por un numero de linea viejo, no se toca nada.
 *
 * El resto del documento se conserva byte a byte, incluidos los `\r` de los
 * finales de linea de Windows y el salto de linea final: `split("\n")` y
 * `join("\n")` son exactamente inversas.
 */
export function toggleCheckboxAtLine(markdown: string, line: number): string {
  if (!Number.isInteger(line) || line < 1) return markdown;

  const lines = markdown.split("\n");
  const current = lines[line - 1];
  if (current === undefined) return markdown;

  const match = CHECKBOX.exec(current);
  if (!match) return markdown;

  const [, before, state, after] = match;
  const flipped = state === " " ? "x" : " ";
  lines[line - 1] = before + flipped + after + current.slice(match[0].length);
  return lines.join("\n");
}

/**
 * Las casillas del documento entero, en orden, con la posicion exacta de su
 * caracter de estado.
 *
 * A diferencia del volteo, esto mira el fuente entero sin que `remark-gfm` le
 * diga que es que, y por eso tiene que saltear los bloques de codigo a mano: un
 * ejemplo de markdown adentro de una cerca no es una tarea de la rutina.
 *
 * `at` es el indice del caracter de estado DENTRO de la linea cruda. Como pelar
 * el `\r` solo saca un caracter del final, el indice vale igual en la cruda que
 * en la pelada, y por eso se puede reescribir un solo caracter sin tocar el
 * final de linea.
 */
function checkboxes(
  lines: string[],
): { line: number; at: number; done: boolean }[] {
  const found: { line: number; at: number; done: boolean }[] = [];
  let fence: string | null = null;

  for (const [index, raw] of lines.entries()) {
    // El `\r` de un archivo guardado con el Bloc de Notas se pela aca. Sin
    // esto, el `(.*)$` de FENCE no llega al final de una cerca con info string
    // (```md) y no la reconoce como apertura: se cuentan las casillas del
    // ejemplo, y después la cerca de CIERRE abre un bloque que no termina
    // nunca y se come todas las casillas reales que vengan atrás.
    const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;

    const next = fenceAfter(line, fence);
    if (next !== undefined) {
      fence = next;
      continue;
    }
    if (fence !== null) continue;

    const match = CHECKBOX.exec(line);
    if (!match) continue;
    found.push({
      line: index + 1,
      at: (match[1] ?? "").length,
      done: match[2] !== " ",
    });
  }

  return found;
}

/** Cuenta las casillas, para el "N DE M HECHAS" del encabezado. */
export function countCheckboxes(markdown: string): {
  done: number;
  total: number;
} {
  const found = checkboxes(markdown.split("\n"));
  return { done: found.filter((box) => box.done).length, total: found.length };
}

/**
 * Desmarca todas las casillas. Es lo que corre al confirmar el ciclo con LISTO:
 * la rutina de la proxima pausa arranca limpia y no hay que desmarcarla a mano.
 *
 * Devuelve **la misma cadena** si no habia ninguna marcada, para que quien
 * llama pueda saltearse la escritura a disco sin comparar el contenido.
 * Reescribe un solo caracter por casilla, asi que el resto del documento
 * -indentacion, finales de linea, salto final- queda intacto.
 */
export function uncheckAll(markdown: string): string {
  const lines = markdown.split("\n");
  const marked = checkboxes(lines).filter((box) => box.done);
  if (marked.length === 0) return markdown;

  for (const box of marked) {
    const raw = lines[box.line - 1] ?? "";
    lines[box.line - 1] = raw.slice(0, box.at) + " " + raw.slice(box.at + 1);
  }
  return lines.join("\n");
}
