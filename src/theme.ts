// El tema, del ajuste persistido al atributo que lee el CSS.
//
// La traduccion vive en el frontend y no en Rust a proposito: `"system"`
// depende de `prefers-color-scheme`, que solo existe adentro del webview. Rust
// guarda el string elegido y lo emite; cada ventana decide que pintar.

/** Lo que el CSS entiende. `index.css` solo define `[data-theme="light"]`. */
export type ResolvedTheme = "dark" | "light";

/**
 * Traduce el ajuste guardado al tema que hay que pintar.
 *
 * `prefersLight` se inyecta en vez de leerse de `matchMedia` acá adentro para
 * que la funcion sea pura y testeable sin un DOM: es la misma regla que usa
 * `timer.ts` con el "ahora".
 *
 * Un valor que no sea ninguno de los tres cae al **oscuro**, que es el default
 * del producto (docs/DESIGN.md §2), y no al del sistema: si `store.json` viene
 * roto, la app tiene que verse como Cairn y no como lo que diga Windows.
 */
export function resolveTheme(
  setting: string,
  prefersLight: boolean,
): ResolvedTheme {
  if (setting === "light") return "light";
  if (setting === "system") return prefersLight ? "light" : "dark";
  return "dark";
}
