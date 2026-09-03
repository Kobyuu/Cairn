import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { toggleCheckboxAtLine, uncheckAll } from "./routine";

export type RoutineMode = "read" | "edit";

/**
 * Desmarca la rutina en disco y devuelve el documento resultante.
 *
 * Vive afuera del hook porque tiene DOS usuarios: el `clearChecks` de abajo,
 * que ademas actualiza la pantalla de Foco, y el boton LISTO del Widget, que no
 * tiene panel de rutina ni necesita el resto del hook. La regla de producto es
 * una sola -confirmar el ciclo deja la rutina limpia para la proxima pausa- y
 * tiene que estar escrita en un solo lugar.
 *
 * Relee del disco en vez de confiar en lo que haya en memoria: LISTO se puede
 * apretar sin haber abierto nunca el panel, y el archivo pudo cambiar desde
 * afuera. `uncheckAll` devuelve la misma cadena si no habia nada marcado, asi
 * que confirmar con la rutina ya limpia no escribe el archivo.
 */
export async function clearRoutineChecks(): Promise<string> {
  const text = await invoke<string>("routine_read");
  const next = uncheckAll(text);
  if (next !== text) {
    await invoke("routine_write", { content: next });
  }
  return next;
}

/**
 * El texto que se le muestra al usuario cuando falla el acceso al archivo.
 *
 * Nuestros comandos de Rust rechazan siempre con un `String` -el `Err(String)`
 * de `routine_read` / `routine_write`, que ya viene redactado y con la ruta
 * adentro-, asi que esa es la rama real. Las otras dos existen porque un
 * `String(cause)` pelado sobre cualquier objeto imprime `[object Object]`, y
 * eso en el panel es peor que no decir nada: el usuario ve un error que no
 * explica nada y no puede ni copiarlo para preguntar.
 */
function errorText(cause: unknown): string {
  if (typeof cause === "string") return cause;
  if (cause instanceof Error) return cause.message;
  // Lo raro va a la consola del webview, que es donde se puede inspeccionar.
  console.error("[cairn] la rutina fallo con algo inesperado:", cause);
  return "no se pudo acceder a la rutina";
}

/**
 * Estado de la rutina: el markdown en memoria, el modo, y el borrador de la
 * edicion.
 *
 * Vive en Foco y no adentro del panel a proposito. El panel se muestra y se
 * esconde con `display`, pero si se desmontara al colapsar, cerrar el panel a
 * mitad de una edicion tiraria lo escrito sin avisar.
 *
 * El archivo en disco es la fuente de verdad: `reload()` lo relee cada vez que
 * se abre el panel, que es lo que hace que editar `routine.md` con el Bloc de
 * Notas y volver a abrir muestre el cambio (SPEC-routine.md, criterio 6).
 */
export function useRoutine() {
  const [source, setSource] = useState<string | null>(null);
  const [modifiedMs, setModifiedMs] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<RoutineMode>("read");
  const [error, setError] = useState<string | null>(null);

  // Todo el acceso al archivo -lecturas Y escrituras- pasa por esta cadena.
  // Tauri despacha cada comando en su runtime asincronico, asi que dos llamadas
  // sueltas no tienen orden garantizado: marcar una casilla y reabrir el panel
  // podria releer el archivo ANTES de que la escritura llegue al disco, mostrar
  // el estado viejo, y que el proximo volteo guarde ese estado viejo pisando la
  // casilla anterior. Encadenadas, cada operacion ve lo que dejo la de antes.
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const next = queue.current.then(operation);
    queue.current = next.catch(() => undefined);
    return next;
  }

  const read = useCallback(
    () => enqueue(() => invoke<string>("routine_read")),
    [],
  );

  const write = useCallback(
    (content: string) => enqueue(() => invoke("routine_write", { content })),
    [],
  );

  const reload = useCallback(() => {
    // Un borrador sin guardar le gana al disco: releer aca borraria lo que el
    // usuario esta escribiendo.
    if (mode === "edit") return;
    read()
      .then((text) => {
        setSource(text);
        setError(null);
      })
      .catch((cause: unknown) => setError(errorText(cause)));
  }, [mode, read]);

  // Se lee una vez al montar, aunque el panel nunca se abra: la etiqueta de
  // arriba de Foco y la fila RUTINA de Ajustes muestran el titulo del
  // documento, y sin esta lectura la pantalla arrancaria sin nombre.
  useEffect(() => {
    read()
      .then((text) => {
        setSource(text);
        setError(null);
      })
      .catch((cause: unknown) => setError(errorText(cause)));
  }, [read]);

  // La fecha del archivo se vuelve a preguntar cada vez que el contenido
  // cambia -lectura inicial, guardado, casilla marcada-, que son exactamente
  // los momentos en que pudo cambiar. `routine_info` devuelve `null` si el
  // archivo todavia no existe, y eso es un estado valido, no un error.
  //
  // La guarda del `null` evita el viaje de mas del arranque: sin ella el efecto
  // corre una vez con el estado inicial vacio y otra cuando llega la lectura,
  // preguntando dos veces por la misma respuesta.
  useEffect(() => {
    if (source === null) return;
    invoke<number | null>("routine_info").then(setModifiedMs).catch(console.error);
  }, [source]);

  const startEdit = useCallback(() => {
    setDraft(source ?? "");
    setMode("edit");
  }, [source]);

  const cancelEdit = useCallback(() => setMode("read"), []);

  const save = useCallback(() => {
    write(draft)
      .then(() => {
        setSource(draft);
        setMode("read");
        setError(null);
      })
      .catch((cause: unknown) => setError(errorText(cause)));
  }, [draft, write]);

  /**
   * Voltea la casilla que empieza en `line` y persiste el archivo entero.
   *
   * La pantalla se actualiza antes de que el disco conteste -marcar una casilla
   * tiene que sentirse instantaneo- y si la escritura falla se vuelve a leer el
   * archivo: mostrar el estado real es mejor que revertir a mano y arriesgarse
   * a pisar una escritura posterior que si funciono.
   */
  const toggleLine = useCallback(
    (line: number) => {
      if (source === null) return;
      const next = toggleCheckboxAtLine(source, line);
      if (next === source) return;
      setSource(next);
      write(next).catch((cause: unknown) => {
        setError(errorText(cause));
        read()
          .then(setSource)
          .catch(() => undefined);
      });
    },
    [source, read, write],
  );

  /** El desmarcado compartido, pero en la cola: no puede cruzarse con la
   *  escritura de una casilla que todavia esta en vuelo. */
  const clearOnDisk = useCallback(() => enqueue(clearRoutineChecks), []);

  /**
   * Desmarca la rutina entera y actualiza la pantalla. Corre al confirmar el
   * ciclo con LISTO: la pausa siguiente arranca con la rutina limpia, sin
   * desmarcarla a mano.
   */
  const clearChecks = useCallback(() => {
    // Con una edicion a medias no se toca el disco: el borrador sin guardar es
    // lo unico que el usuario no puede recuperar.
    if (mode === "edit") return;
    clearOnDisk()
      .then(setSource)
      .catch((cause: unknown) => setError(errorText(cause)));
  }, [mode, clearOnDisk]);

  /** Abre el Explorador con `routine.md` seleccionado (fila RUTINA de Ajustes). */
  const reveal = useCallback(() => {
    invoke("routine_reveal").catch((cause: unknown) => setError(errorText(cause)));
  }, []);

  return {
    source,
    modifiedMs,
    draft,
    mode,
    error,
    clearChecks,
    reload,
    startEdit,
    cancelEdit,
    setDraft,
    save,
    toggleLine,
    reveal,
  };
}
