# SPEC: `presence-modes` — Etapa 4

Padre: [`CAPABILITY-MAP.md`](CAPABILITY-MAP.md) · Depende de: `system-integration` · Label: `stage:4-modes`

## Objetivo

Los tres modos de presencia y la conmutación en caliente entre ellos. **Es la
etapa difícil**, y por eso llega cuarta: si el temporizador y los ajustes no son
sólidos, acá se mezclan dos clases de bug y no se distingue cuál es cuál.

Orden interno obligatorio: **Foco → Widget → Ambiente**. Ambiente último porque
es el único que combina transparencia, click-through y geometría por monitor.

## Diseño (canónico: `docs/architecture.md` §D4–D6)

**Tres ventanas de Tauri, no una reconfigurada.** No existe `set_transparent`: la
transparencia es un atributo de creación del `HWND`. Ambiente la necesita, Foco
necesita lo opuesto. Las tres cargan **el mismo bundle**
(`index.html?view=foco|widget|ambient`), así que es una sola base de código.

Conmutar de modo = `show()` de una y `hide()` de las otras dos. **Nunca** toca el
estado del temporizador (CLAUDE.md §2).

| Modo         | Config de creación                                                                                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Foco**     | sin bordes, al tamaño del monitor, always-on-top, enfocable. **No** `set_fullscreen(true)` (D5)                                                                            |
| **Widget**   | sin bordes, chica, always-on-top, arrastrable, recuerda posición                                                                                                           |
| **Ambiente** | `transparent`, `decorations:false`, `shadow:false`, `skipTaskbar:true`, `alwaysOnTop:true`, `focus:false`, `resizable:false` + `set_ignore_cursor_events(true)` en runtime |

### Ambiente: monitor y DPI

Monitor **primario**, recalculado si cambia la configuración de pantallas. La
franja es percepción periférica: si salta de monitor según dónde esté el mouse,
dejás de mirarla. Seguir el cursor además exigiría pollear la posición del mouse.

Geometría **en píxeles físicos**, sin excepción:

```rust
let m = app.primary_monitor()?.unwrap();
let s = m.scale_factor();                                   // 1.0 / 1.25 / 1.5 / 2.0
win.set_position(PhysicalPosition::new(m.position().x, m.position().y))?;
win.set_size(PhysicalSize::new(m.size().width, (h_css * s).round() as u32))?;
```

Con `LogicalSize`, Tauri multiplica por la escala **de la ventana en ese
momento**, que puede no ser todavía la del monitor destino. El alto se multiplica
a mano para que mida lo mismo a 100% y a 150%.

**Altura, según el handoff de diseño (sustituye los 4 px del brief original):**
3 px normalmente; **5 px en el último 10% del ciclo**, respirando con la curva
`breathe` de 5,5 s. El ancho de la barra pintada = porcentaje de ciclo
transcurrido, en pasos de 1%, sin easing. La ventana siempre ocupa el ancho
completo del monitor; lo que crece es el relleno, no la ventana.

Al vencer conmuta a Foco; al confirmar o posponer vuelve a Ambiente.

## Criterios de aceptación

1. Los tres modos se cambian desde el menú de la bandeja, en caliente.
2. **Cambiar de modo no altera el contador** — verificable mirando el restante
   antes y después.
3. Foco cubre la pantalla completa, incluida la barra de tareas, y queda encima.
4. El widget se arrastra y **recuerda su posición** al cerrar y reabrir la app.
5. Ambiente es invisible salvo la franja, **no aparece en la barra de tareas**, y
   el mouse la atraviesa: se puede clickear lo que está debajo.
6. La franja mide 3 px visuales tanto al 100% como al 150% de escala de Windows.
7. En el último 10% del ciclo pasa a 5 px y respira.
8. Al vencer estando en Ambiente, aparece Foco; al confirmar, vuelve a Ambiente.
9. El modo por defecto sale de `store.json` y se respeta al arrancar.

## Tests (TDD)

Lo testeable es la aritmética; lo visual va a checklist.

- `cargo test` — geometría de Ambiente como función pura
  `fn ambient_rect(monitor_pos, monitor_size, scale, height_css) -> (x,y,w,h)`: a
  escala 1.0 con alto 3 → 3 px; a 1.5 → 5 px (`round`); a 2.0 → 6 px; el ancho
  siempre igual al del monitor; el origen igual al del monitor — **incluido un
  monitor con `x` negativo**, que es el caso donde un `as u32` descuidado explota.
- `cargo test` — la transición de modo deja `Phase` **idéntica**. Es el test que
  protege la regla inquebrantable de CLAUDE.md §2.
- `vitest` — el porcentaje de avance del ciclo: 0% al empezar, 100% al vencer,
  escalonado de a 1%, y el umbral de los 5 px cae exactamente en 90%.

## Verificación manual

- [ ] Cambiar Foco → Widget → Ambiente → Foco: el restante no cambió nunca.
- [ ] Widget: arrastrarlo, cerrar la app, reabrir → sigue en el mismo lugar.
- [ ] Ambiente: no figura en la barra de tareas ni en `Alt+Tab`.
- [ ] Ambiente: clickear un icono del escritorio que quede debajo de la franja →
      el click pasa.
- [ ] Cambiar la escala de Windows a 150%, reiniciar Cairn → la franja se ve del
      mismo grosor que al 100%.
- [ ] Con dos monitores: la franja está en el primario, y sigue ahí al desconectar
      y reconectar el secundario.
- [ ] Esperar al último 10%: la franja engorda y respira.
- [ ] Vencer estando en Ambiente → aparece Foco; "Listo" → vuelve a Ambiente.

## Límites

- **Nunca:** reconfigurar una sola ventana para hacer de los tres modos.
- **Nunca:** recrear ventanas al conmutar. Se crean al arrancar y se muestran u
  ocultan.
- **Nunca:** `LogicalSize`/`LogicalPosition` para Ambiente.
- **Limitación aceptada:** una app en fullscreen exclusivo (juego, video) tapa la
  franja. No hay solución sin un overlay a nivel driver. No intentarlo.
- **No todavía:** la estética. El handoff se aplica en la etapa 6; acá Ambiente
  puede ser un rectángulo liso mientras cumpla la geometría.

## Preguntas abiertas

- **Ambiente en pausa: el handoff lo deja sin definir.** Intención declarada:
  congelar el ancho y bajar la opacidad, sin animación. Se implementa así salvo
  que Manu diga otra cosa al probar la etapa.
