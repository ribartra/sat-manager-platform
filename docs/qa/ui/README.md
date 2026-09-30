# UI — márgenes estables entre vistas (2026-09-29)

**Objetivo:** que el contenido de todas las vistas empiece y termine en la misma posición absoluta que la barra de navegación, con el mismo ritmo vertical. Se decidió **un único ancho** para todo: 72rem, igual que la barra.

## Método
- **Arnés:** `scripts/qa/ui-margins.mjs` (Playwright) recorre **58 vistas** con los roles admin, teacher, student, parent y anónimo, sobre una copia sembrada de la base y un build de producción. Mide en el DOM:
  - la x del logo de la barra;
  - la x y el ancho del contenedor de página (`[data-page-shell]`);
  - la x del `h1`;
  - la distancia entre la barra y el primer contenido;
  - si hay scroll horizontal.
- **Pixeles:** `scripts/qa/ui-margins-pixels.py` confirma en las capturas cuál es la primera columna con contenido (distancia absoluta en píxeles).
- **Resoluciones:** 1440×900 y 390×844.
- **Datos:** tabla por vista en [margins-table.md](./margins-table.md); datos crudos en `margins-*.json` y `pixels-*.json`; hojas de contacto `contact-before-1440.png` y `contact-after-1440.png`. La línea roja marca x = 160.

## Antes (1440 px)
La barra tenía el logo en **x = 160** (contenedor de 1152 px), pero las páginas usaban 3 anchos centrados:

| x del título | Vistas |
|---|---|
| 160 | 12 |
| 224 | 21 |
| 400 | 13 |
| 241, 340, 425, 477 o 580 | 9 |

Además:
- La barra del apoderado estaba en x = 208.
- La separación entre la barra y el contenido variaba entre **16 y 32 px**, según la "densidad" de cada página.
- A 390 px, **5 vistas tenían scroll horizontal**: Admin Import, Review File, Students y sus redirecciones, y el detalle de intento.

## Después
| Métrica | 1440 px | 390 px |
|---|---|---|
| Contenedor de página (x / ancho) | **144 / 1152 en 49/49 vistas** | **0 / 390, padding 16, en 50/50** |
| Título / primera tinta (píxeles) | 160–161 px | 16–17 px |
| Barra → primer contenido | **32 px en 49/49**; "Student view" tiene 69 px, por su banner ámbar | 32 px |
| Scroll horizontal | 0 | **0** |

La única excepción de tinta es "Student view", cuyo banner ocupa todo el ancho a propósito. Los reproductores (práctica/FPT, sin barra) y las páginas de login y cuentas (tarjeta centrada) se midieron aparte y quedan igual.

## Cambios
- **`PageShell`:** un solo ancho (`--sat-page-wide`), el mismo `py-8` en todas las densidades, `PageHeader` siempre con `mb-6` y marca `data-page-shell`.
- **Tokens:** `--sat-page-narrow` y `--sat-page-default` apuntan ahora a `--sat-page-wide`.
- **Barras:** teacher, admin, student, apoderado, notificaciones y banner de "Student view" usan el mismo token, con `px-4` dentro del contenedor.
- **Vistas corregidas:**
  - **Admin:** `/admin/import/ai/sets` usa `PageShell`; Review File usa el ancho común, antes 100rem, con `grid-cols-1` / `min-w-0`, y sin `<main>` anidado.
  - **`PracticeAreaTabs`:** sin `-mx-1`, porque sacaba la línea 4 px fuera del contenedor.
  - **404:** página propia dentro del portal (teacher, student y admin) y en la raíz.
  - **Desbordes a 390 px:** botones de Import con `flex-wrap`, tarjetas "Low performance" con `min-w-0` y tabla del intento con scroll propio.
  - **Formularios Invite Student y Edit Student:** en 2 columnas, para que no queden desproporcionados a ancho completo.
