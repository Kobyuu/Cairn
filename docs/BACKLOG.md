# Backlog

Ideas sueltas. Se procesan ítem por ítem según CLAUDE.md §6: preguntar,
convertir en spec, crear el issue, y vaciar este archivo.

- **`tauri.conf.json` tiene `"csp": null`.** Es deuda previa a la etapa 5, pero
  recién ahora empieza a pagar: desde que la rutina se renderiza adentro de la
  ventana, hay contenido en pantalla que no escribimos nosotros. La etapa 5 ya
  cerró la vía de red por el lado del renderizador (`localUrl` en
  `src/views/Routine.tsx` bloquea todo esquema absoluto), así que esto sería
  defensa en profundidad, no el arreglo. Una CSP tipo
  `img-src 'self' asset: data:; script-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'`
  hay que probarla a mano: Tailwind v4 entra como hoja propia (`'self'`, bien) y
  los `style={{…}}` de React se aplican por CSSOM (que CSP no gatea), pero
  cambiar `null` por una política real puede romper el render y hay que verlo.
