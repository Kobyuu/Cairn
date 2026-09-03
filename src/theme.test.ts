import { describe, expect, it } from "vitest";
import { resolveTheme } from "./theme";

describe("resolveTheme", () => {
  it("obedece la eleccion explicita, sin mirar el sistema", () => {
    expect(resolveTheme("dark", true)).toBe("dark");
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("light", false)).toBe("light");
  });

  it("sigue a prefers-color-scheme cuando el ajuste es 'system'", () => {
    expect(resolveTheme("system", true)).toBe("light");
    expect(resolveTheme("system", false)).toBe("dark");
  });

  // `store.json` es un archivo que el usuario puede abrir con el Bloc de Notas
  // y Rust ya acota el valor, pero el frontend tambien recibe el string crudo
  // de un evento: un valor inventado cae al default del producto, que es el
  // oscuro (docs/DESIGN.md §2), y nunca al tema del sistema.
  it("un tema inventado cae al oscuro", () => {
    expect(resolveTheme("neon", true)).toBe("dark");
    expect(resolveTheme("", true)).toBe("dark");
  });
});
