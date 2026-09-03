import { useEffect, useRef } from "react";
import { playAlertTone, unlockAudioOnFirstGesture } from "./sound";
import type { Phase } from "./timer";

/**
 * Toca el tono del aviso en la TRANSICION a vencido, no mientras dura.
 *
 * Vive afuera de `Foco` porque no es layout: es la unica logica con estado de
 * esa pantalla que no tiene nada que ver con lo que se dibuja, y adentro del
 * componente sumaba una condicion de cuatro terminos, un `ref` y dos efectos a
 * una funcion que ya es larga.
 *
 * `previousKind` arranca en `undefined` y esa es la guarda que importa: si la
 * app se abre con el ciclo ya vencido -volver de suspender, reiniciar la PC-,
 * el primer render no es una transicion y no tiene que sonar. Solo el paso de
 * corriendo (o pausado) a vencido lo es.
 *
 * `soundOn` esta en las dependencias y no adentro de un `if` temprano por una
 * razon: cuando el usuario enciende el interruptor con el ciclo ya vencido, el
 * efecto vuelve a correr, pero `previousKind` ya dice `elapsed` y no suena. Es
 * el comportamiento que se quiere -el aviso ya paso-.
 */
export function useAlertTone(
  phaseKind: Phase["kind"] | undefined,
  soundOn: boolean,
): void {
  const previousKind = useRef<Phase["kind"] | undefined>(undefined);

  useEffect(() => {
    const before = previousKind.current;
    previousKind.current = phaseKind;
    const isTransition = before !== undefined && before !== "elapsed";
    if (soundOn && phaseKind === "elapsed" && isTransition) {
      playAlertTone();
    }
  }, [phaseKind, soundOn]);

  // Con el sonido apagado -que es el default- no se crea ningun AudioContext.
  useEffect(() => (soundOn ? unlockAudioOnFirstGesture() : undefined), [soundOn]);
}
