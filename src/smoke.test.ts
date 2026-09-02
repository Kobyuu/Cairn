import { expect, test } from "vitest";

// Unico proposito: demostrar que vitest realmente ejecuta algo. Si este test
// pasa sin que exista el archivo, el runner esta mintiendo.
test("el runner de vitest corre", () => {
  expect(1 + 1).toBe(2);
});
