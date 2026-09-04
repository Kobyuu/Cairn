# SPEC-distribution — Modelo de negocio y distribución de Cairn

> Issue [#16](https://github.com/Kobyuu/Cairn/issues/16) · `stage:landing` · `area:build` · `area:web`
> Fuera del capability map, igual que [SPEC-landing](SPEC-landing.md): no es una
> etapa 7. La lógica de la app no se toca.

## 1. Objetivo

Decidir cómo se monetiza Cairn y publicar el primer release instalable, para que
el CTA de la landing deje de decir «PRÓXIMAMENTE» y apunte a una descarga real.

El objetivo declarado de Manu es **«sacar un par de dólares»**, no construir un
negocio. Esa restricción, y no el gusto, es la que decide todo lo de abajo: a
esta escala lo que hay que maximizar es la **cantidad de descargas**, no el
precio por descarga.

## 2. Modelo de negocio (cerrado)

**Gratis, con propina, y un pack de temas opcional más adelante.**

Sin licencia obligatoria, sin suscripción, sin anuncios, sin cuentas y sin
servidor. La promesa de `CLAUDE.md` §2 —datos locales, sin red, sin
telemetría— queda intacta, que es exactamente lo que la landing ya publicó.

### Las tres alternativas que se descartaron, con su razón

| Alternativa | Por qué no |
| --- | --- |
| **Licencia única US$ 18** (lo que proponía el brief) | Un `.exe` sin firmar, sin reputación y sin marketing detrás de un paywall no vende: el precio no filtra compradores, espanta descargas. Ingreso esperable US$ 0–20, y a cambio destruye el único activo que el release genera, que es que la gente lo instale. |
| **Gacha con anuncios** | Los anuncios exigen red, telemetría y un servidor de inventario: contradice literalmente el copy ya publicado en `site/index.html`. No existe una red de anuncios usable para una app de escritorio fuera de tienda. Y hay una contradicción de producto peor: Cairn vale porque **obliga al acto de confirmar** — es una app anti-compulsión — y el gacha es ingeniería de compulsión. |
| **SaaS con sincronización** | Hoy Cairn no tiene una sola línea de red. Sincronizar obliga a cuentas, servidor, resolución de conflictos offline, webhooks de cobro y custodia de datos de terceros: meses de trabajo y ~US$ 10–20/mes **para siempre**. Una suscripción es una obligación que sobrevive al entusiasmo: si el servidor se apaga, a cada persona que pagó se le rompe la app. Mal trato por «un par de dólares». |

**Lo que sí sobrevive de la idea de las mascotitas.** Lo que Manu vio en apps
como Flo no es gacha: es un **frasco de propinas con premio** — pagás lo que un
café y te llevás algo lindo. Sin aleatoriedad, sin anuncios y sin servidor: los
cosméticos viajan dentro del binario. Ese mecanismo sí encaja, y se adopta.

Lo que **no** se adopta es la mascota como forma. Criaturas moviéndose por la
pantalla pelean de frente con la dirección *Aliento* (`docs/DESIGN.md` es
normativo, y la barra de Ambiente es de 3 px y **nunca se anima**). El
cosmético que se vende son **packs de temas**: Cairn ya tiene selector de tema
con tres chips y el comando `settings_set_theme`, así que cinco paletas más son
idénticas en plomería, y en vez de contradecir la identidad visual, *son* la
identidad visual.

## 3. Las ocho preguntas del issue, contestadas

| # | Pregunta | Decisión | Razón |
| --- | --- | --- | --- |
| 1 | ¿Gratis, licencia o suscripción? | **Gratis** + cosmético opcional | §2 |
| 2 | ¿Beta gratuita primero? | **Sí** — es el release 1 | Es el camino barato a tener descargas y feedback |
| 3 | ¿Cómo se cobra? | **Diferido al release 2** | Manu tiene PayPal y Stripe: no bloquea nada hoy |
| 4 | ¿Cómo se valida la licencia? | **Diferido al release 2**, dirección: sin clave | §6 |
| 5 | ¿Firma de código? | **No** | §4 |
| 6 | ¿Instalador o `.exe` suelto? | **Instalador NSIS**, per-user | §5 |
| 7 | ¿Actualizaciones? | **No** | `tauri-plugin-updater` implica un endpoint, o sea una llamada saliente que necesita decisión explícita (`CLAUDE.md` §2). Y con un solo release no hay nada que actualizar. |
| 8 | ¿Analítica en la landing? | **No** | La página promete «sin backend, sin red, sin telemetría». Cualquier script de terceros la desmiente. |

## 4. Firma de código: no, y el issue estaba desactualizado

El issue estimaba «~US$ 200–400/año y sin firma SmartScreen asusta al 90 % de
las descargas», con el supuesto implícito de que firmar resuelve el susto. **Ya
no es cierto**, y por eso la decisión es no firmar:

- **Desde marzo de 2024 los certificados EV ya no suprimen automáticamente el
  aviso de SmartScreen.** EV y OV construyen reputación por igual, de a poco,
  a medida que se acumulan descargas. Pagar EV dejó de comprar la inmunidad que
  compraba.
- **Precios 2026:** OV ~US$ 200–385/año, EV ~US$ 296–580/año. Ninguno de los dos
  evita el aviso el día del lanzamiento.
- **La opción barata no aplica.** Azure Artifact Signing (ex Trusted Signing)
  cuesta US$ 9,99/mes, pero para **desarrolladores individuales está limitado a
  EE.UU. y Canadá**.
- **Y es un gasto recurrente creciente:** desde el 1/3/2026 los certificados de
  code signing duran como máximo 458 días.

US$ ~250/año para no resolver el problema, contra un ingreso esperable de
US$ 0–50, es aritmética que se resuelve sola. **Se sale sin firmar y se avisa en
la landing**, con la voz de la marca, en vez de esconderlo.

## 5. Instalador: NSIS

Verificado contra el fuente del bundler (no contra la documentación, que no lo
menciona):

- **NSIS** escribe `PKEY_AppUserModel_ID` con el valor de `BUNDLEID` en los
  accesos directos del **menú Inicio y del escritorio**
  (`installer.nsi:949,952,976`) y lo limpia al desinstalar (`:824`).
- **MSI** lo pone **solo** en el del menú Inicio (`main.wxs:205`).

Gana NSIS, y además: instala por usuario sin pedir permisos de administrador
(`installMode` ya viene en `currentUser` por defecto, así que **no se escribe en
la config** — un valor que no cambia no se configura), pesa menos y se puede
compilar sin Windows.

**El `identifier` ya es `com.kobyuu.cairn`**, así que el AppUserModelID no se
configura: sale de ahí. Esto es lo que desbloquea el toast propio de
`docs/DESIGN.md` §7 — pero **desbloquear no es implementar**: si Cairn debe
avisar con un toast en vez de tapar la pantalla («avisar sin taparte») sigue
siendo una decisión de producto, y no es de esta spec.

**Idiomas del instalador:** `["SpanishInternational", "English"]`. Verificado
contra las traducciones que Tauri empaqueta
(`crates/tauri-bundler/src/bundle/windows/nsis/languages/`): los nombres válidos
son los del archivo `.nsh`, no códigos ISO. NSIS usa el idioma del sistema si
está en la lista, y si no, el primero.

## 6. Alcance

### Entra (release 1, v0.1.0)

1. **`src-tauri/tauri.conf.json`** — activar el bundle:
   `active: true`, `targets: ["nsis"]`, `publisher`, `copyright`, `license`,
   `homepage`, `shortDescription`, `longDescription`, y
   `windows.nsis.languages`.
2. **Binario** — `pnpm tauri build` produce `Cairn_0.1.0_x64-setup.exe`.
3. **Release `v0.1.0`** — tag y GitHub Release con el instalador adjunto y notas
   en español. **Lo ejecuta Manu** (`CLAUDE.md` §6: nada de git sin su OK).
4. **Landing (`site/index.html`)** — los tres botones `PRÓXIMAMENTE` (nav,
   héroe, cierre) pasan a ser enlaces reales a la descarga; nota honesta sobre
   el aviso de SmartScreen; enlace de propina en el pie; y en el JSON-LD
   `offers` con precio 0, `softwareVersion` y `downloadUrl`.
5. **Correcciones de documentación obligadas** — ver §7.

### No entra

- Firma de código, `tauri-plugin-updater`, analítica (§3).
- Checkout, claves de licencia y packs de temas: son el release 2.
- Cualquier cambio en `src/` o `src-tauri/src/`. No hay lógica nueva.
- MSI. Se elige uno y es NSIS (§5).
- Pasar `prettier` sobre los 16 archivos que nunca lo vieron. Es ruido que
  ensucia el diff del release; va en su propio cambio.
- La decisión de «avisar sin taparte» (`docs/DESIGN.md` §7). Este release la
  **desbloquea**; resolverla es producto, no plomería.

## 7. Documentación que este cambio vuelve falsa

Tres archivos afirman hoy cosas que dejan de ser ciertas. Corregirlos es parte
del alcance, no una tarea aparte:

| Archivo | Qué dice hoy | Qué pasa a decir |
| --- | --- | --- |
| `CLAUDE.md` §4 | «No configurar firma de código, actualizador automático ni instalador MSI/NSIS hasta que Manu lo pida» | El instalador NSIS **entra**; firma y updater siguen pospuestos, ahora con la razón real (§4) en vez de «es una app personal» |
| `docs/DESIGN.md` §7 | «sin instalador que registre el `AppUserModelID` (CLAUDE.md §4: todavía no hay), Windows lo emite con la identidad de PowerShell» | Ya hay instalador y ya registra el AUMID. El toast propio pasa de *imposible* a *decisión de producto pendiente* |
| `docs/specs/SPEC-landing.md` §2 | filas «CTA → PRÓXIMAMENTE deshabilitado» y «Sección de precio → no se publica» | CTA real apuntando al release; la sección de precio **sigue sin publicarse**, ahora porque el producto es gratis, no porque falte checkout |

## 8. Verificación

**No hay tests que escribir.** El cambio es configuración de bundle, HTML
estático y documentación: ninguna lógica nueva, y `CLAUDE.md` §7 pide tests para
lógica no trivial, no para claves de un JSON. La suite existente tiene que
seguir en verde, y eso es todo lo que aporta.

### Automática

Los cinco comandos de `CLAUDE.md` §7, una sola vez al final:

```
pnpm lint
pnpm typecheck
pnpm test
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
```

### Manual — la que realmente importa

1. `pnpm tauri build` termina y deja
   `src-tauri/target/release/bundle/nsis/Cairn_0.1.0_x64-setup.exe`.
2. El instalador **no pide permisos de administrador** y muestra el asistente en
   español.
3. Tras instalar: Cairn arranca desde el menú Inicio, aparecen los tres modos y
   el ciclo corre.
4. **El acceso directo lleva el AppUserModelID.** Con el atajo del menú Inicio
   en `%AppData%\Microsoft\Windows\Start Menu\Programs\Cairn.lnk`, verificar que
   su propiedad `System.AppUserModel.ID` vale `com.kobyuu.cairn`.
5. Desinstalar desde «Aplicaciones instaladas» deja el sistema limpio: sin
   accesos directos y sin la carpeta de instalación.
6. **La landing:** los tres CTA descargan el archivo, y la nota de SmartScreen
   está visible antes de que el usuario haga clic, no después.

## 9. Release 2 (diferido, no se implementa ahora)

Se construye **sólo si el release 1 tiene descargas**. Se anota acá para que la
decisión no se vuelva a discutir desde cero:

- **Qué se vende:** un pack de 5–6 paletas adicionales, ~US$ 4.
- **Cómo se entrega, dirección propuesta:** el pack es un **archivo local** que
  se deja en el directorio de datos de la app — sin clave, sin criptografía y
  sin llamada de validación. Es coherente con `CLAUDE.md` §3 («archivos de texto
  que el usuario tiene que poder abrir con el Bloc de Notas») y con §2. Sí, se
  puede compartir; a US$ 4 y con esta audiencia, el esfuerzo de construir
  validación cuesta más que la pérdida que evita.
- **Procesador:** a definir entre Lemon Squeezy y Paddle, que actúan como
  *merchant of record* y resuelven IVA e impuestos. Sería la **primera
  dependencia externa del proyecto** y por lo tanto necesita el aviso previo de
  `CLAUDE.md` §5 antes de integrarse.
- **Precio en la landing:** la sección de precio vuelve recién acá.
