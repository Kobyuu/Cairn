import { describe, expect, it } from "vitest";
import { elapsedMs, formatDuration, parseMinutes, remainingMs, type Phase } from "./timer";

describe("parseMinutes", () => {
  it("acepta enteros de un minuto para arriba", () => {
    expect(parseMinutes("1")).toBe(1);
    expect(parseMinutes("17")).toBe(17);
    expect(parseMinutes(" 45 ")).toBe(45);
  });

  it("trunca decimales en vez de mandarlos a un u64 de Rust", () => {
    expect(parseMinutes("4.5")).toBe(4);
  });

  it("rechaza lo que no es un numero, para que no termine en un snooze rapido", () => {
    expect(parseMinutes("abc")).toBeNull();
    expect(parseMinutes("")).toBeNull();
    expect(parseMinutes("Infinity")).toBeNull();
  });

  it("rechaza cero y negativos", () => {
    expect(parseMinutes("0")).toBeNull();
    expect(parseMinutes("-5")).toBeNull();
    expect(parseMinutes("0.4")).toBeNull();
  });
});

describe("remainingMs", () => {
  it("running: returns deadline minus now", () => {
    const phase: Phase = { kind: "running", deadlineMs: 10_000 };
    expect(remainingMs(phase, 4_000)).toBe(6_000);
  });

  it("running: never negative once now is past the deadline", () => {
    const phase: Phase = { kind: "running", deadlineMs: 10_000 };
    expect(remainingMs(phase, 999_999_999)).toBe(0);
  });

  it("running: exactly zero at the deadline", () => {
    const phase: Phase = { kind: "running", deadlineMs: 10_000 };
    expect(remainingMs(phase, 10_000)).toBe(0);
  });

  it("paused: returns the frozen remaining duration regardless of now", () => {
    const phase: Phase = { kind: "paused", remainingMs: 7_000 };
    expect(remainingMs(phase, 0)).toBe(7_000);
    expect(remainingMs(phase, 999_999)).toBe(7_000);
  });

  it("idle: always zero", () => {
    const phase: Phase = { kind: "idle" };
    expect(remainingMs(phase, 123)).toBe(0);
  });

  it("elapsed: always zero (it has no remaining time, it counts up instead)", () => {
    const phase: Phase = { kind: "elapsed", sinceMs: 5_000 };
    expect(remainingMs(phase, 6_000)).toBe(0);
  });
});

describe("elapsedMs", () => {
  it("elapsed: returns now minus sinceMs", () => {
    const phase: Phase = { kind: "elapsed", sinceMs: 5_000 };
    expect(elapsedMs(phase, 8_000)).toBe(3_000);
  });

  it("elapsed: never negative if now is before sinceMs (clock jump back)", () => {
    const phase: Phase = { kind: "elapsed", sinceMs: 5_000 };
    expect(elapsedMs(phase, 1_000)).toBe(0);
  });

  it("elapsed: grows as now grows", () => {
    const phase: Phase = { kind: "elapsed", sinceMs: 5_000 };
    const early = elapsedMs(phase, 6_000);
    const later = elapsedMs(phase, 9_000);
    expect(later).toBeGreaterThan(early);
  });

  it("running/paused/idle: always zero", () => {
    expect(elapsedMs({ kind: "running", deadlineMs: 10_000 }, 20_000)).toBe(0);
    expect(elapsedMs({ kind: "paused", remainingMs: 10_000 }, 20_000)).toBe(0);
    expect(elapsedMs({ kind: "idle" }, 20_000)).toBe(0);
  });
});

describe("formatDuration", () => {
  it("zero", () => {
    expect(formatDuration(0)).toBe("00:00");
  });

  it("44:59 (spec exact case)", () => {
    expect(formatDuration(2_699_000)).toBe("44:59");
  });

  it("1:00:00 at exactly one hour", () => {
    expect(formatDuration(3_600_000)).toBe("1:00:00");
  });

  it("pads seconds and minutes under ten", () => {
    expect(formatDuration(65_000)).toBe("01:05");
  });

  it("truncates stray milliseconds instead of rounding up", () => {
    // 1999 ms is 1 second and 999 stray ms: must read as 1s, not 2s.
    expect(formatDuration(1_999)).toBe("00:01");
  });

  it("hour form keeps minutes and seconds zero-padded", () => {
    expect(formatDuration(3_661_000)).toBe("1:01:01");
  });

  it("just under an hour stays in mm:ss form", () => {
    expect(formatDuration(3_599_000)).toBe("59:59");
  });
});
