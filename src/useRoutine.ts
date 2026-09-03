import { invoke } from "@tauri-apps/api/core";
import { useCallback, useRef, useState } from "react";
import { toggleCheckboxAtLine, uncheckAll } from "./routine";

export type RoutineMode = "read" | "edit";

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

  /**
   * Desmarca la rutina entera. Corre al confirmar el ciclo con LISTO: la pausa
   * siguiente arranca con la rutina limpia, sin desmarcarla a mano.
   *
   * Relee del disco en vez de usar el `source` en memoria porque LISTO se puede
   * apretar sin haber abierto nunca el panel -y entonces no hay nada en
   * memoria-, y porque el archivo pudo cambiar desde afuera. `uncheckAll`
   * devuelve la misma cadena si no habia nada marcado, asi que confirmar un
   * ciclo con la rutina ya limpia no escribe el archivo.
   */
  const clearChecks = useCallback(() => {
    // Con una edicion a medias no se toca el disco: el borrador sin guardar es
    // lo unico que el usuario no puede recuperar.
    if (mode === "edit") return;
    read()
      .then((text) => {
        const next = uncheckAll(text);
        setSource(next);
        if (next !== text) return write(next);
      })
      .catch((cause: unknown) => setError(errorText(cause)));
  }, [mode, read, write]);

  return {
    source,
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
  };
}
