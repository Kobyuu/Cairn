import { cycleProgress, FINAL_STRETCH } from "../timer";
import { useTimer } from "../useTimer";

// Vista Ambiente (etapa 4, docs/DESIGN.md §4 y el handoff "Cairn Widget y
// Ambiente.dc.html" secc. 6b). Una franja horizontal arriba de la pantalla,
// sin texto, que no recibe clicks.
//
// La ventana mide siempre 5 px CSS de alto -Rust le reserva esa altura
// fisica de entrada- para que el paso de 3 a 5 px en el ultimo tramo sea puro
// CSS y no haga falta redimensionar la ventana a mitad de ciclo. Este
// componente pinta la barra anclada arriba a la izquierda, con la altura real
// del tramo en curso.
export default function Ambient() {
  const { snapshot, nowMs } = useTimer();

  if (snapshot === null) {
    return null;
  }

  const { phase } = snapshot;
  const isPaused = phase.kind === "paused";
  const isElapsed = phase.kind === "elapsed";
  const progress = cycleProgress(phase, nowMs);
  const final = progress >= FINAL_STRETCH;

  // Opacidad: 40 % → 90 % linealmente con el avance (docs/DESIGN.md §4), fija
  // en pausa y en 100 % al vencer. La formula ya llega a ~90 % justo cuando
  // `progress` se acerca a 1 -que es a donde tiende antes de pasar a
  // `elapsed`-, asi que no hace falta un caso especial para el ultimo tramo.
  let opacityPct: number;
  if (isPaused) {
    opacityPct = 18;
  } else if (isElapsed) {
    opacityPct = 100;
  } else {
    opacityPct = 40 + progress * 50;
  }

  // Respira solo en el ultimo tramo mientras corre: en pausa queda quieta
  // -la quietud es el mensaje-, y al vencer es un instante fijo antes de que
  // aparezca Foco, no un estado que dure lo suficiente para respirar.
  const breathe = final && !isPaused && !isElapsed;

  return (
    <div
      className={breathe ? "cairn-breathe absolute top-0 left-0" : "absolute top-0 left-0"}
      style={{
        pointerEvents: "none",
        // Sin transicion ni easing: el avance ya viene escalonado de a 1 %
        // (docs/DESIGN.md §3), y una barra que se anima continuamente pide
        // que la mires -una que salta de a un porciento se lee de reojo.
        width: `${progress * 100}%`,
        height: final ? 5 : 3,
        background: `color-mix(in oklab, var(--color-am) ${opacityPct}%, transparent)`,
      }}
    />
  );
}
