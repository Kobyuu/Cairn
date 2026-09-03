import { useState } from "react";
import { cycleProgress, remainingMs, FINAL_STRETCH } from "../timer";
import { useTimer } from "../useTimer";

// Vista Widget (etapa 4, docs/DESIGN.md §4 y el handoff "Cairn Widget y
// Ambiente.dc.html" secc. 6a). La ventana mide 176 × 68 px exactos y es
// transparente de verdad (CLAUDE.md §11): este componente pinta una caja que
// ocupa el 100 % de esa ventana.
//
// El widget solo se ve en `running` o `paused` -Rust muestra Foco al vencer-,
// pero igual tiene que compilar y no romperse en `elapsed`: `remainingMs`
// devuelve 0 ahi y no hay ninguna rama especial que agregar.
export default function Widget() {
  const { snapshot, nowMs } = useTimer();
  const [hovered, setHovered] = useState(false);

  // Ventana de 176px: no hay lugar para un estado de carga, así que no se
  // pinta nada hasta que llega el primer snapshot.
  if (snapshot === null) {
    return null;
  }

  const { phase } = snapshot;
  const isPaused = phase.kind === "paused";
  const minutes = Math.ceil(remainingMs(phase, nowMs) / 60_000);
  const progress = cycleProgress(phase, nowMs);
  // El ultimo tramo (punto que respira, hairline mas grueso) es una senal de
  // "se acerca el final" que no aplica en pausa: ahi todo queda congelado y
  // en gris, sin importar en que porcentaje del ciclo se pauso.
  const final = !isPaused && progress >= FINAL_STRETCH;

  const [labelTop, labelBottom] = isPaused ? ["EN", "PAUSA"] : ["MIN", "RESTANTES"];

  // El color del hairline de progreso, en el mismo orden en que mandan los
  // estados: la pausa gana sobre todo -congelada y en gris-, despues el ultimo
  // tramo, y si no el acento de reposo.
  let hairline = "var(--ac-70)";
  if (isPaused) {
    hairline = "var(--fg-22)";
  } else if (final) {
    hairline = "var(--ac-90)";
  }

  return (
    <div
      // "deep" y no el atributo pelado: la caja esta tapada por sus hijos (la
      // cifra, la etiqueta), y sin "deep" Tauri exige que el click caiga
      // EXACTAMENTE sobre este elemento para poder arrastrar (CLAUDE.md §11).
      data-tauri-drag-region="deep"
      className="cairn-press relative flex h-full w-full items-center"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        boxSizing: "border-box",
        borderRadius: 5,
        padding: "0 18px",
        gap: 11,
        // 62 % en reposo, 82 % en hover (handoff 6a). Sin backdrop-filter: no
        // hay nada detras de una ventana transparente que el webview pueda
        // muestrear, asi que el blur del handoff no hace nada aca. Tampoco la
        // sombra del handoff: es un color hardcodeado que, sobre una ventana
        // transparente, deja un halo cuadrado en vez de una sombra.
        background: hovered ? "var(--bg-82)" : "var(--bg-62)",
        border: `1px solid ${hovered ? "var(--fg-20)" : "var(--fg-10)"}`,
      }}
    >
      <div
        className="font-sans"
        style={{
          fontSize: 38,
          fontWeight: 300,
          lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
          color: isPaused ? "var(--fg-66)" : "var(--color-fg)",
        }}
      >
        {minutes}
      </div>
      <div
        className="font-mono"
        style={{
          fontSize: 9,
          letterSpacing: ".24em",
          lineHeight: 1.8,
          color: isPaused ? "var(--fg-30)" : "var(--fg-42)",
        }}
      >
        {labelTop}
        <br />
        {labelBottom}
      </div>
      {final && (
        <div
          className="cairn-breathe rounded-full"
          style={{ width: 6, height: 6, marginLeft: "auto", background: "var(--color-ac)" }}
        />
      )}
      <div
        className="absolute bottom-0 left-0"
        style={{
          height: final ? 3 : 2,
          width: `${progress * 100}%`,
          borderRadius: "0 2px 2px 0",
          background: hairline,
        }}
      />
    </div>
  );
}
