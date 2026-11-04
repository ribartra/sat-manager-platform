# Puntos para Fase 2

Documento de trabajo interno. Reúne lo que queda para después de la Fase 1, que es el flujo de contenido:

> catálogo → asignación → resolución → resultados → importación

Los tres bloques principales son:

- la evolución del rendimiento en el tiempo;
- la marca;
- la personalización.

Al final están otros puntos detectados en el trabajo reciente.

Cada punto sigue el mismo esquema:

1. **Hoy:** lo que existe en la plataforma.
2. **Propuesta:** lo que se haría.
3. **Por decidir:** lo que tiene que definir el equipo antes de construir.
4. **Listo cuando:** el criterio de aceptación.

Las prioridades (P1, P2) son una propuesta técnica, a confirmar.

---

## 1. Evolución del rendimiento en el tiempo

Pospuesto como **SAT-035** en `SAT_Platform_TODO_2026-10-26.md` §7 y en `consideraciones.md` §7: "se discutió, no se aprobó como ajuste inmediato".

### Hoy
- **Serie de puntajes de Test:** `lib/student-report.ts` ya calcula `scoreSeries`, con un punto por intento de Test (total, R&W y Math, fecha y tiempo). Un Test repetido sale como "TEST 9 · try 2". **Ninguna pantalla lo muestra.**
- **Componente de gráfico:** existe `components/sat/line-chart.tsx` y hoy no se usa.
- **Filtro de periodo:** All time, Last 30/60/90 days o Custom (`components/sat/period-filter.tsx`). Está en los informes y en el PDF del alumno.
- **Resultados de práctica:** se calculan con la regla del **último intento por set, ponderado por preguntas**. No hay vista en el tiempo.
- **Intentos recalculados:** un intento puede cambiar de nota si se corrige una clave ("Graded again on …").

### Propuesta
1. **Gráfico de puntajes de Test** (P1), para alumno, profesor (en la ficha del alumno) y padre (en el informe y el PDF):
   - total y por sección (R&W, Math);
   - eje por fecha;
   - cada punto con su Test y su intento ("TEST 9 · try 2").
2. **Gráfico de práctica por sección y habilidad** (P2): % en el tiempo con la misma regla de último intento ponderado. Así el gráfico coincide con las tablas y no promedia entre sets distintos.
3. **Meta del alumno** (P2): puntaje objetivo y fecha del examen, como línea horizontal y marca en el eje.
4. **Vista de grupo para el profesor** (P2): evolución del programa o de un grupo, con promedios solo donde la regla lo permita.
5. **Señales en el gráfico:** intentos invalidados fuera de la serie (como hoy en los totales) e intentos recalculados marcados con su aviso.

### Por decidir
- **Eje X:** por fecha o por número de intento.
- **Tests distintos frente a reintentos:** mezclarlos en una sola línea o separarlos, por ejemplo "progreso entre tests" y "reintentos de un mismo test".
- **Ventana por defecto:** se mencionó seis semanas; hoy existen 30/60/90 días y Custom.
- **Muchos Tests:** cómo se ve con decenas (últimos N, paginación o agrupar por mes).
- **Práctica:** si el % por habilidad se muestra en el tiempo o solo como foto actual.

### Listo cuando
- El gráfico es explicable con decenas de Tests y nunca confunde Tests distintos con intentos del mismo Test.
- Coincide con las tablas y el PDF para el mismo periodo.
- Se ve en alumno, profesor y padre con el mismo componente.

---

## 2. Marca

### Hoy
- **El nombre del producto no está unificado:**
  - "SAT Practice Platform": título de la pestaña (`app/layout.tsx`), login, Terms y Privacy;
  - "SAT Practice" (alumno y padre) y "SAT Platform" (profesor y admin), en la barra lateral (`components/app-shell.tsx`);
  - "SAT Practice — …" en los asuntos de los correos;
  - dominio `satsol.org`, y "Plataforma SOL" en las notas de reuniones.
- **El logo es texto:** las letras "SAT" en un círculo azul. No hay favicon propio ni imagen para compartir enlaces (Open Graph).
- **La paleta y los estilos están definidos:** tokens CSS del mockup (`--sat-*`), una sola anchura de página y componentes base (`components/sat/`).
- **Los correos** (invitaciones, avisos, recuperación de contraseña) y **el PDF del informe** no tienen cabecera de marca.

### Propuesta
1. **Un nombre de producto** (P1), aplicado en todos lados: pestaña, login, barra lateral, correos, PDF, páginas legales, manuales y dominio.
2. **Logo e ícono** (P1): logotipo, isotipo para la barra lateral y favicon (más el ícono de "agregar a inicio" en el celular).
3. **Guía de marca corta** (P2): paleta (los tokens actuales, documentados), tipografía y tono de voz. El tono ya sigue la regla de lenguaje simple para usuarios no técnicos.
4. **Correos con plantilla** (P1): cabecera con logo, pie con firma y enlaces legales, mismo tono.
5. **PDF del informe con portada** (P2): logo, nombre del alumno, periodo y fecha.
6. **Manuales en Word con la plantilla de la empresa** (P2): con `pandoc --reference-doc=plantilla.docx` (ver `docs/manual/README.md`).

### Por decidir
- Nombre final: SAT Platform, SAT Practice, SOL u otro.
- Quién es dueño de la marca y quién entrega los archivos (logo en SVG, colores oficiales, tipografía con licencia).
- Dominio o dominios definitivos.
- Si los materiales de terceros (College Board, Innovator) pueden mostrarse con su nombre o logo. Va con SAT-031, licencias y procedencia.

### Listo cuando
- Una persona nueva ve un solo nombre y un solo logo en la web, los correos, el PDF y los manuales.

---

## 3. Personalización

### Hoy
- **El programa ya es el "tenant":** sus profesores comparten el banco (preguntas, sets, Tests y materiales), y cada profesor ve solo a sus alumnos.
- **Lo que ya se puede personalizar:**
  - por profesor: el nombre y la foto;
  - por asignación: el modo de feedback, si se muestran las explicaciones, la fecha y el contexto (Classroom u Homework).
- **El modelo `Program` no tiene campos de marca:** ni logo, ni colores, ni nombre visible, ni remitente de correo.

### Propuesta

**Por programa o institución** (P1, después de la marca):

- logo, nombre visible y colores dentro de los tokens (acento y primario), para no romper el contraste;
- remitente y "responder a" de los correos, firma y enlaces legales propios;
- subdominio propio (opcional, P2);
- una pantalla de admin para editarlo, con vista previa.

**Por profesor** (P2):

- firma en los correos;
- valores por defecto al asignar: modo de feedback, explicaciones, días hasta la fecha límite y contexto;
- filtros recordados.

**Por alumno** (P2):

- idioma de la interfaz, ES o EN (los manuales ya existen en ambos);
- accesibilidad: tamaño de letra, alto contraste, tipografía para dislexia, menos animaciones;
- tema oscuro;
- meta: puntaje objetivo y fecha del examen (alimenta el gráfico de la sección 1);
- qué avisos recibe y por qué medio.

**Por padre** (P2): frecuencia e idioma del informe.

**Lo que NO se personaliza:**

- la forma de calcular puntajes;
- la estructura de un Test (módulos, tiempos y 27/27/22/22);
- las reglas de desbloqueo;
- el formato de los resultados.

Así un mismo resultado se lee igual en todos los programas.

### Por decidir
- Si la personalización por programa es un requisito comercial, es decir, si varias instituciones usarán la misma plataforma con su propia marca.
- Qué colores puede elegir un programa y con qué límite.
- Si el idioma ES/EN de la interfaz entra en la Fase 2. Hoy la interfaz está en inglés y los manuales en ES y EN.

### Listo cuando
- Un programa con su logo y colores se ve con su marca en la web, los correos y el PDF, sin perder legibilidad (contraste AA).
- Lo que no es personalizable se ve igual en todos los programas.

---

## 4. Otros puntos detectados para Fase 2

| Punto | Hoy | Propuesta |
|---|---|---|
| Draft parcial de un Practice Set | Un Test en Draft recibe después las preguntas que faltaban ("Add N questions to the Draft"); un Practice Set no. | El mismo flujo para los Practice Sets. |
| Nivel "Topic" debajo de Skill | Falta en la taxonomía. La tabla `Topic` ocupa el lugar de Skill y `Subskill` está vacía (ver `CLAUDE.md`, Taxonomía). | Catálogo de topics y renombrar en la UI "Subskill → Topic". |
| Regla del 75% después de recalcular | Un intento recalculado no desbloquea ni bloquea sets (se decidió así). | Revisar con la profesora si una corrección de clave debe abrir el set siguiente. |
| Retomar un intento en otro dispositivo | Después de un cierre por inactividad se vuelve a la página, pero solo en el mismo navegador. | Guardar el "volver aquí" en el servidor, por usuario. |
| Espacio en el servidor | El disco de la VM es de 20 GB y la limpieza borra imágenes de más de 72 h. | Conservar solo la versión actual y la anterior, sin importar su antigüedad. |
| Review (AI Import admin) | En la vista de OCR, el riel "Extracted Tests" ya no se oculta, pero sigue ocupando su columna. | Que, al ocultarlo, la columna se libere. |
| Figuras de PDF que son capturas | El recorte llega como máximo a la resolución de la captura (no se amplía con IA). | Pedir a las fuentes los PDF originales (vectoriales) cuando existan. |

---

## 5. Preguntas abiertas para el equipo

1. ¿Cuál es el nombre final del producto y quién entrega el logo y los colores oficiales?
2. ¿La plataforma tendrá varias instituciones con su propia marca (personalización por programa)?
3. ¿El gráfico de Tests mezcla Tests distintos y reintentos, o los separa?
4. ¿Cuál es la ventana por defecto del gráfico (6 semanas, 30/60/90 días)?
5. ¿El alumno puede fijar su meta (puntaje y fecha), o la fija el profesor?
6. ¿Entra el idioma ES/EN de la interfaz en esta fase?
7. ¿Qué podemos mostrar de las fuentes de terceros (nombre o logo de College Board, Innovator)?

---

## 6. Priorización propuesta

| Prioridad | Punto | Depende de |
|---|---|---|
| P1 | Nombre y logo únicos en web, correos, PDF y manuales | Decisión de marca (pregunta 1) |
| P1 | Gráfico de puntajes de Test (alumno, profesor, padre) | Semántica del gráfico (preguntas 3 y 4) |
| P1 | Plantilla de correos | Marca |
| P1 | Marca por programa (si aplica) | Marca; pregunta 2 |
| P2 | Gráfico de práctica por sección y habilidad | Gráfico de Tests |
| P2 | Meta del alumno en el gráfico | Gráfico de Tests; pregunta 5 |
| P2 | Vista de grupo del profesor | Gráfico de Tests |
| P2 | Preferencias de profesor, alumno y padre | — |
| P2 | Portada del PDF y plantilla Word de los manuales | Marca |
| P2 | Puntos de la sección 4 | — |

El orden recomendado es primero la **marca** (todo lo demás la usa), después la **semántica del gráfico** antes de construir componentes, y la **personalización** al final, sobre la marca ya definida.
