Para tu caso —**uso personal, plataforma propia, solo calculadora embebida**— lo más probable es que puedas usar la **API de Desmos con una API key**, sin que tus usuarios/alumnos tengan que iniciar sesión en Desmos. La API oficial permite insertar la calculadora en una web/app mediante un script y un `div`; la propia documentación indica que debes incluir `calculator.js?apiKey=...` y luego crear un `Desmos.GraphingCalculator(...)`. ([Desmos][1])

## 1. Requerimientos mínimos

Necesitas:

1. Una página web propia: HTML, React, Vue, Angular, Next.js, etc.
2. Una **API key de Desmos**.
3. Cargar el script oficial de Desmos.
4. Crear un contenedor `<div>` para la calculadora.
5. Inicializar la calculadora con JavaScript.
6. Tener conexión a internet desde el navegador, porque el script se carga desde Desmos.
7. No usar iframe con `desmos.com/calculator`, porque eso muestra la web completa con login, header y navegación.

La API key se obtiene desde **Desmos My API**. La documentación oficial dice que para usar la API en tu página debes pasar una API key como parámetro en la URL del script. ([Desmos][1])

## 2. Sobre si es gratis o pagado

Para **uso personal y no comercial**, los términos actuales de la API mencionan un “Trial Tier” permitido para uso personal no comercial. También indican que el uso comercial incluye aplicaciones en producción accedidas por usuarios finales o uso interno con propósito empresarial. ([Desmos][2])

En simple:

```text
Uso personal, para ti:
  probablemente puedes usar el tier gratuito / trial.

Plataforma abierta a alumnos, clientes o usuarios reales:
  ya puede considerarse producción/comercial.

Plataforma de negocio, academia, SaaS o institución:
  deberías revisar licencia/pago con Desmos.
```

Para tu caso “para mí nomás”, no deberías necesitar una licencia enterprise. Pero sí necesitas revisar el panel de API de Desmos y aceptar sus términos.

## 3. El login de Desmos no lo necesita tu usuario

Tu plataforma mantiene su propio login.

```text
Tu usuario inicia sesión en tu plataforma
        ↓
Tu frontend carga la calculadora Desmos con tu API key
        ↓
El usuario usa la calculadora embebida
        ↓
No necesita cuenta Desmos
```

El login de Desmos aparece cuando se muestra la **web completa** de Desmos, normalmente por iframe o por abrir directamente `desmos.com/calculator`. Con API oficial, se renderiza solo el componente de calculadora.

## 4. Implementación mínima en HTML

Crea una página de prueba, por ejemplo `desmos-test.html`:

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Prueba Desmos API</title>

  <script src="https://www.desmos.com/api/v1.12/calculator.js?apiKey=TU_API_KEY"></script>

  <style>
    #calculator {
      width: 100%;
      height: 500px;
      border: 1px solid #ddd;
    }
  </style>
</head>
<body>
  <h1>Calculadora Desmos embebida</h1>

  <div id="calculator"></div>

  <script>
    const elt = document.getElementById("calculator");

    const calculator = Desmos.GraphingCalculator(elt, {
      expressions: true,
      settingsMenu: false,
      zoomButtons: true,
      keypad: true,
      images: false,
      pasteGraphLink: false
    });

    calculator.setExpression({
      id: "eq1",
      latex: "2x + 6 = 14"
    });
  </script>
</body>
</html>
```

Eso debería mostrar solo la calculadora, no el header de Desmos.

## 5. Opciones recomendadas para una plataforma de práctica

Para una plataforma tipo SAT practice, yo usaría algo así:

```js
const calculator = Desmos.GraphingCalculator(elt, {
  expressions: true,
  settingsMenu: false,
  zoomButtons: true,
  keypad: true,
  expressionsTopbar: false,
  images: false,
  folders: false,
  notes: false,
  pasteGraphLink: false,
  lockViewport: false,
  border: true,
  language: "es"
});
```

La documentación lista muchas opciones configurables, como `expressions`, `settingsMenu`, `zoomButtons`, `keypad`, `images`, `folders`, `notes`, `lockViewport`, entre otras. ([Desmos][1])

Para examen o práctica controlada, conviene desactivar:

```text
images: false
pasteGraphLink: false
notes: false
folders: false
settingsMenu: false
```

Así evitas que el usuario use cosas innecesarias o copie estados externos.

## 6. React / Next.js: componente básico

Si tu plataforma está en React o Next.js, hazlo como componente cliente.

```jsx
import { useEffect, useRef } from "react";

export default function DesmosCalculator({ initialLatex }) {
  const containerRef = useRef(null);
  const calculatorRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !window.Desmos) return;

    calculatorRef.current = window.Desmos.GraphingCalculator(
      containerRef.current,
      {
        expressions: true,
        settingsMenu: false,
        zoomButtons: true,
        keypad: true,
        expressionsTopbar: false,
        images: false,
        folders: false,
        notes: false,
        pasteGraphLink: false,
        border: true
      }
    );

    if (initialLatex) {
      calculatorRef.current.setExpression({
        id: "question-equation",
        latex: initialLatex
      });
    }

    return () => {
      calculatorRef.current?.destroy();
    };
  }, [initialLatex]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "500px" }}
    />
  );
}
```

Y en tu layout o página cargas el script:

```html
<script src="https://www.desmos.com/api/v1.12/calculator.js?apiKey=TU_API_KEY"></script>
```

En Next.js podrías cargarlo con `next/script`.

## 7. La pregunta sigue viniendo de tu backend

Tu backend debería devolver algo así:

```json
{
  "id": "q001",
  "statement": "Which value of x satisfies 2x + 6 = 14?",
  "choices": [
    { "label": "A", "text": "x = 2" },
    { "label": "B", "text": "x = 3" },
    { "label": "C", "text": "x = 4" },
    { "label": "D", "text": "x = 5" }
  ],
  "desmosLatex": "2x + 6 = 14"
}
```

Tu frontend renderiza:

```text
Pregunta y alternativas → tu plataforma
Calculadora → Desmos API
Respuesta marcada → tu plataforma
Scoring → tu backend
```

Desmos no reemplaza tu banco de preguntas.

## 8. Guardar estado de la calculadora por intento

Opcionalmente puedes guardar lo que el usuario hizo en Desmos:

```js
const state = calculator.getState();
const serialized = JSON.stringify(state);
```

Y luego restaurarlo:

```js
calculator.setState(JSON.parse(serialized));
```

La API documenta `getState()` y `setState()` para guardar/restaurar el estado de la calculadora. ([Desmos][3])

Esto sirve si quieres que al volver a una pregunta se mantengan las expresiones que el usuario escribió.

## 9. Checklist final

Para hacerlo bien:

```text
1. Crear cuenta/API key en Desmos My API.
2. Confirmar que el uso sea personal/no comercial.
3. Cargar calculator.js con tu API key.
4. Renderizar un div propio, no iframe.
5. Instanciar Desmos.GraphingCalculator.
6. Configurar opciones para ocultar funciones innecesarias.
7. Traer preguntas desde tu backend.
8. Pasar ecuaciones iniciales a Desmos con setExpression.
9. Guardar respuestas en tu plataforma, no en Desmos.
10. Opcionalmente guardar estado con getState/setState.
```

Mi recomendación: empieza con una página HTML plana para verificar tu API key. Luego recién lo pasas a tu framework real.

[1]: https://www.desmos.com/api "Desmos API v1.12 documentation"
[2]: https://www.desmos.com/api-terms?utm_source=chatgpt.com "API Terms of Service"
[3]: https://www.desmos.com/api/v1.7/docs/index.html?utm_source=chatgpt.com "Desmos API v1.7 documentation"

