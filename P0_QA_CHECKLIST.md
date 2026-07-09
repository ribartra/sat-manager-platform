# P0 QA Checklist

Checklist mínimo para cerrar P0 de Fase 1.

## 1) Verificación estática rápida

Ejecutar:

```bash
npm run qa:p0
```

Debe terminar con `P0 static verification passed.`

## 2) Regresión de snapshots (historial inmutable)

1. Crear/asignar un Practice Set publicado.
2. Resolver y enviar un intento como alumno.
3. Abrir resultado del intento y guardar captura del stem/respuesta correcta.
4. Editar la pregunta en el banco (stem o correctAnswer).
5. Volver al resultado del intento ya enviado.

Esperado:

- El intento histórico mantiene la versión original.
- Un intento nuevo usa la versión editada.

## 3) Ciclo de vida de intentos

1. Completar intento #1.
2. Pulsar `Try Again` y completar intento #2.
3. Invalidar intento #2 con razón opcional.
4. Reabrir intento #1 con razón opcional.

Esperado:

- `Try Again` crea un nuevo intento (`attemptNumber` aumenta).
- Invalidate/Reopen registran `auditLog` con acción y metadata (razón si existe).
- Reopen deja intento en `IN_PROGRESS`.

## 4) Importación robusta con preview

1. Ir a `/admin/import`.
2. Pegar CSV con comas, comillas y multilinea.
3. Clic en `Preview & Validate`.
4. Confirmar filas válidas/inválidas.
5. Importar.

Esperado:

- Preview muestra número de fila y errores por fila.
- Se crean solo filas válidas.
- Respuesta final lista errores de filas inválidas.

## 5) Seguridad por rol/scope (mínimo manual)

Probar con cuentas de Student, Parent, Teacher y Admin:

- Student no puede leer/modificar intentos de otro estudiante por URL.
- Teacher no puede abrir datos de alumnos fuera de sus programas.
- Parent no accede a rutas de teacher/admin.
- Rutas admin devuelven 403 para teacher/student/parent.

Esperado:

- Siempre responde 401/403/404 según corresponda.
