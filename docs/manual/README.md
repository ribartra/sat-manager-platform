# Manuales de usuario — SAT Practice Platform

| Documento | Idioma | Para quién |
|---|---|---|
| [manual-profesor.es.md](manual-profesor.es.md) | Español | Profesores (incluye profesor maestro y padres) |
| [teacher-manual.en.md](teacher-manual.en.md) | English | Teachers (includes master teacher and parents) |
| [manual-alumno.es.md](manual-alumno.es.md) | Español | Alumnos |
| [student-manual.en.md](student-manual.en.md) | English | Students |
| [guia-importacion-ia.es.md](guia-importacion-ia.es.md) | Español | Administrador y profesor maestro: importar y mantener sets y Tests con IA |
| [cuentas-demo.md](cuentas-demo.md) | Español | Cuentas ficticias usadas para las capturas |

- Las capturas están en [`img/`](img/). Son de la interfaz real (en inglés), por eso las comparten las versiones en español e inglés.
- Se tomaron con Playwright sobre una **copia local** de la base, con usuarios ficticios. No aparece ningún dato real.
- Para regenerarlas (por ejemplo tras un cambio de interfaz), ver [`_tools/README.md`](_tools/README.md).

## Pasar a Word

Las rutas de las imágenes son relativas (`img/…`), así que hay que convertir **desde esta carpeta**.

Con [pandoc](https://pandoc.org) (`sudo apt install pandoc`):

```bash
cd docs/manual
mkdir -p word
for f in manual-profesor.es teacher-manual.en manual-alumno.es student-manual.en guia-importacion-ia.es; do
  lang=$([[ $f == *.en ]] && echo en-US || echo es-PE)
  pandoc "$f.md" -o "word/$f.docx" --resource-path=. -M lang=$lang
done
```

Los Word quedan en `word/` (no se suben al repositorio: se regeneran). Sin `--toc`: cada manual ya trae su propio índice ("Contenido" / "Contents").

Para usar los estilos de la empresa (fuentes, colores, portada), crea un documento Word de referencia y añade `--reference-doc=plantilla.docx`.

Las capturas miden 1440 px de ancho y Word las ajusta al ancho de la página. Las de página completa (las más altas) pueden ocupar varias páginas: si hace falta, recórtalas en Word.
