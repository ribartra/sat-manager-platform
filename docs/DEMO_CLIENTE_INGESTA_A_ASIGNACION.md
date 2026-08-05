# Demo Cliente: Ingesta A Pregunta Asignada

Esta demo muestra el flujo completo desde contenido extraido por IA hasta una pregunta oficial asignada a estudiantes.

## Verificacion Previa

Ejecutar:

```bash
npm run demo:verify
```

El resultado esperado inicia con `DEMO_READY`. Si falta algo, el comando reporta exactamente que dato debe corregirse.

## Caso Estrella

- Pregunta oficial: `cmsdhprnu001elit15beasdxb`
- Practice Set: `AI Sample Hard Practice Set`
- Dificultad: `HARD`
- Tema: `Polynomials`
- Fuente: `PRACTICE EXERCISES/EXERCISES MATH/ADVANCED MATH/EQUIVALENT EXPRESSION/EQUIVAL. EXPRESS.  HARD1.pdf`
- Respuesta correcta: `C`

Enunciado:

```text
If $a=c+d$, which of the following is equivalent to the expression $x^2-c^2-2cd-d^2$?
```

Alternativas:

- A: `$(x+a)^2$`
- B: `$(x-a)^2$`
- C: `$(x+a)(x-a)$`
- D: `$x^2-ax-a^2$`

## Flujo De Presentacion

1. Entrar como administrador con `admin@sat.com` / `admin123`.
2. Abrir el modulo de carga IA y ubicar el archivo fuente indicado.
3. Mostrar que el candidato esta promovido a pregunta oficial.
4. Entrar como docente con `teacher@sat.com` / `teacher123`.
5. Abrir `AI Sample Hard Practice Set` y mostrar la pregunta publicada con LaTeX y alternativas.
6. Entrar como estudiante con `student1@sat.com` / `student123`.
7. Abrir el Practice Set asignado, responder la pregunta y enviar el intento.

## Datos De Asignacion

El set esta asignado a:

- `student1@sat.com` / Ana Torres
- `student2@sat.com` / Luis Mora

Ambas asignaciones deben estar en estado `PENDING` y desbloqueadas.
