# Estado de la instancia GCP

Snapshot operativo de sat-vm en el proyecto sat-sol-gsc, capturado el
2026-09-13 a las 18:37 UTC (13:37 PET), antes de poner la instancia en pausa.
Los valores secretos no se incluyen; solo se registra si están configurados.

## Resumen

- VM: sat-vm, zona us-east1-b, estado al capturar: RUNNING.
- Stack: Caddy, aplicación web Next.js e ingestión FastAPI activos; web e ingestión
  reportaron healthy y sus health checks internos respondieron 200.
- Dominio público: https://satsol.org/, respondió 307 hacia /login.
- Datos persistentes: /data está montado desde el disco sat-data.
- Base SQLite: /data/db/dev.db, modo WAL, aproximadamente 88 MB.
- Ingesta principal: completada, 231 archivos y 3.999 páginas procesadas.
- Pendientes: 2 cargas aisladas en PENDING, ambas con una página aún no contabilizada.
- Incidencias: 896 abiertas y 1.146 resueltas.
- Observación: existen eventos antiguos en RUNNING/STARTED entre el 3 y el 8 de
  agosto, aunque el lote principal figura completado.

## Infraestructura GCP

| Elemento | Estado / valor |
| --- | --- |
| Proyecto | sat-sol-gsc |
| Instancia | sat-vm |
| Zona | us-east1-b |
| Tipo | e2-medium |
| Sistema operativo | Debian GNU/Linux 12 (Bookworm) |
| Kernel | 6.1.0-52-cloud-amd64 |
| Arquitectura | x86-64 |
| IP interna | 10.142.0.2 |
| IP externa observada | 35.243.173.180 |
| Red | default |
| Etiqueta de red | sat-web |
| Reinicio automático | Activado |
| Mantenimiento del host | MIGRATE |
| vTPM | Activado |
| Integrity Monitoring | Activado |
| Secure Boot | Desactivado |
| Cuenta de servicio | sat-vm@sat-sol-gsc.iam.gserviceaccount.com |

### Discos

| Disco | Tipo | Tamaño | Auto-eliminación | Uso observado |
| --- | --- | ---: | --- | --- |
| sat-vm | pd-standard | 20 GB | Sí, al eliminar la VM | /: 16 GB usados, 82%; 3.5 GB libres |
| sat-data | pd-balanced | 50 GB | No | /data: 3.3 GB usados, 7%; 45.6 GB libres |

sat-data está formateado como ext4 y montado en /data mediante /etc/fstab.
Docker usa /data/docker como data root.

## Persistencia y archivos

| Ruta | Contenido | Tamaño / conteo |
| --- | --- | ---: |
| /data/db | SQLite y archivos WAL | 88 MB |
| /data/uploads | Archivos públicos | 6.761 archivos |
| /data/private | Staging y artefactos privados | 1.3 GB |
| /data/private/uploads/ingest | Artefactos privados de ingesta | 69.000 archivos |
| /data/docker | Capas e imágenes Docker | 2.9 GB |
| /data/caddy | Certificados y configuración Caddy | 120 KB |
| /data/stack | Compose productivo y .env no secreto | 12 KB |
| /data/backups-local | Copias SQLite locales | 1.8 GB |

/app/files_to_load no existe dentro del contenedor web actual. La ingesta
histórica está registrada en la base y sus artefactos están en /data, pero el
directorio original de entrada no es un volumen persistido del contenedor.

## Stack desplegado

Compose: /data/stack/docker-compose.yml. Proyecto Compose: sat-platform.

| Servicio | Imagen | Estado | Exposición |
| --- | --- | --- | --- |
| web | sat-images/web:17d390a | Up, healthy | interno 3000 |
| ingest-service | sat-images/ingest:17d390a | Up, healthy | interno 8000 |
| caddy | caddy:2 | Up | host 80, 443 |

Los servicios tienen restart: unless-stopped. Montajes:

- web: /data/db:/db, /data/uploads:/app/public/uploads,
  /data/private:/app/.private;
- ingestión: /data/db:/db, /data/private:/app/.private;
- Caddy: configuración y certificados en /data/caddy.

Caddy publica satsol.org, usa HTTPS automático y limita el cuerpo de carga a
256MB. La ingesta no está publicada directamente al host. La aplicación usa
escritura dual de archivos públicos hacia GCS durante la migración.

### Variables configuradas

Se verificó la presencia, sin copiar valores, de AUTH_URL, AUTH_TRUST_HOST,
AUTH_SECRET, SECRET_ENCRYPTION_KEY, INTERNAL_INGEST_TOKEN, MISTRAL_API_KEY,
MISTRAL_OCR_MODEL, MISTRAL_STRUCTURING_MODEL, CORS_ALLOWED_ORIGINS, EMAIL_FROM,
EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS, REGISTRY, TAG y DOMAIN.

Modelos observados: mistral-ocr-latest y mistral-large-latest. La clave de
Mistral está configurada, sin revelar su contenido.

## Estado de la base de datos

SQLite reportó journal_mode=wal, page_count=21337 y freelist_count=107.

| Tabla / entidad | Registros |
| --- | ---: |
| User | 6 |
| Program | 1 |
| Question | 2.597 |
| QuestionOption | 9.228 |
| PracticeSet | 91 |
| PracticeSetQuestion | 1.615 |
| FullPracticeTest | 10 |
| FullPracticeTestQuestion | 980 |
| Assignment | 6 |
| FullPracticeTestAssignment | 1 |
| ProgramEnrollment | 1 |
| ParentStudent | 1 |
| IngestBatch | 3 |
| IngestSourceFile | 233 |
| IngestQuestionCandidate | 2.605 |
| IngestAnswerCandidate | 3.297 |
| IngestPageArtifact | 3.999 |
| IngestImageArtifact | 6.897 |
| IngestCandidateImageLink | 553 |
| IngestOcrCache | 1.110 |
| IngestIncident | 2.042 |
| IngestJobEvent | 266 |
| IngestReviewSession | 1 |
| AuditLog | 1.044 |

### Preguntas oficiales

- Estado: 2.595 PUBLISHED y 2 ARCHIVED.
- Candidatos por sección: 1.274 MATH y 1.331 RW.
- Dificultad de candidatos: 1.056 EASY, 532 MEDIUM, 1.015 HARD y 2 sin
  dificultad.
- Tipo oficial: 2.309 MC y 288 NUMERIC.
- Dificultad oficial: 1.055 EASY, 529 MEDIUM, 1.013 HARD y 2 sin dificultad.

### Lotes y archivos de ingesta

| Lote | Estado | Archivos | Páginas | Procesados | Candidatos | Errores |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| SAT files_to_load ingest | COMPLETED | 231 | 3.999 | 231 / 231 | 2.601 | 0 |
| Practice Set PDF import | PENDING | 1 | 0 | 0 / 1 | 0 | 0 |
| Advanced Math - Nonlinear Equations - HARD - #1 | PENDING | 1 | 0 | 0 / 1 | 0 | 0 |

En IngestSourceFile hay 231 archivos COMPLETED y 2 PENDING:

- PRACTICE_SET: 182 completados;
- FULL_PRACTICE_TEST: 49 completados;
- pendientes: 2 fuentes PRACTICE_SET.

Los 2.605 candidatos aparecen con status=REJECTED y promotionStatus=REJECTED.
Sin embargo, 2.597 tienen officialQuestionId y 8 no lo tienen; el contador de
promotionStatus=PROMOTED es 0. Esta combinación de campos debe revisarse al
retomar el trabajo porque no representa claramente el ciclo de promoción
observado en las preguntas oficiales.

## Incidencias

### Resumen

| Estado | Total |
| --- | ---: |
| OPEN | 896 |
| RESOLVED | 1.146 |

### Incidencias abiertas

| Código | Severidad | Total | Interpretación |
| --- | --- | ---: | --- |
| FULL_TEST_ANSWER_CONFLICT | WARNING | 770 | Respuestas existentes y parseadas no coinciden. |
| OPTION_IMAGE_OCR_UNRESOLVED | WARNING | 44 | No se convirtieron algunas imágenes en opciones A-D. |
| FULL_TEST_ANSWER_MATCH_AMBIGUOUS | WARNING | 29 | Asociación respuesta-pregunta no unívoca. |
| CANDIDATE_IMAGE_LINK_INCOMPLETE | WARNING | 29 | Candidato sin imagen correctamente vinculada. |
| FULL_TEST_ANSWER_GROUP_COUNT_MISMATCH | WARNING | 13 | Cantidad de respuestas distinta al grupo de preguntas. |
| FULL_TEST_DUPLICATE_QUESTION_NUMBER | WARNING | 6 | Número duplicado dentro del conjunto. |
| FULL_TEST_ANSWER_KEY_MISSING | WARNING | 2 | Falta una clave de respuestas esperada. |
| FULL_TEST_ANSWER_MATCH_MISSING | INFO | 1 | No se encontró respuesta para un candidato. |
| STEM_EMBEDDED_HTML_OR_TABLE | WARNING | 1 | Enunciado con tabla o formato embebido pendiente. |
| DOCX_FULL_TEST_IMAGE_LINK_PENDING | WARNING | 1 | 15 preguntas de Test 1 RW no tienen STEM asociado automáticamente. |

Las incidencias abiertas afectan a 66 archivos distintos. Archivos Full Practice
Test implicados:

- MOCK EXAMS/TEST 1/Answers Key Test 1_.docx
- MOCK EXAMS/TEST 1/MATH/Answers Test 1 Innovator CHECKED.docx
- MOCK EXAMS/TEST 1/MATH/TEST 1 INNOVATOR MATH MOD 1 AND 2.pdf
- MOCK EXAMS/TEST 1/Reading and Writing/ Test 1 Module 1, 2B R&W.docx
- MOCK EXAMS/TEST 1/Reading and Writing/Test1 RW Answer Explanations.docx
- MOCK EXAMS/TEST 10/ TEST 10 ANS KEY.docx
- MOCK EXAMS/TEST 10/MATH/Test 10 Innov. Math.pdf
- MOCK EXAMS/TEST 10/READING AND WRITING/INNOVATORS TEST 10 RW 1, 2B.pdf
- MOCK EXAMS/TEST 10/Test10_Math_Answer_Explanations.docx
- MOCK EXAMS/TEST 10/Test10_RW_Answer_Explanations.docx
- MOCK EXAMS/TEST 2/Test2 Math Answer Exp.docx
- MOCK EXAMS/TEST 2/Test2 RW Answer Explanations.docx
- MOCK EXAMS/TEST 3/ANS Key Test 3.docx
- MOCK EXAMS/TEST 3/Test3 Math Answer Explan_.docx
- MOCK EXAMS/TEST 3/Test3 RW Answer Expl.docx
- MOCK EXAMS/TEST 4/ TEST 4 ANS KEY.docx
- MOCK EXAMS/TEST 4/Test4_Math_Answer_Explanations(1).docx
- MOCK EXAMS/TEST 4/Test4_Math_Answer_Explanations.docx
- MOCK EXAMS/TEST 5/READING AND WRITING/Test5_RW_Answer_Explanations.docx
- MOCK EXAMS/TEST 5/Test5_Math_Answer_Explanations.docx
- MOCK EXAMS/TEST 5/Test5_RW_Answer_Explanations.docx
- MOCK EXAMS/TEST 6/TEST 6 ANS KEY.docx
- MOCK EXAMS/TEST 6/Test6_Math_Answer_Explanations.docx
- MOCK EXAMS/TEST 6/Test6_RW_Answer_Explanations.docx
- MOCK EXAMS/TEST 7/TEST 7 ANS KEY.docx
- MOCK EXAMS/TEST 7/Test7_Math_Answer_Explanations.docx
- MOCK EXAMS/TEST 8/MATH/TEST 8 INNOV MATH MOD 1&2.pdf
- MOCK EXAMS/TEST 8/Test8_Math_Answer_Explanations.docx
- MOCK EXAMS/TEST 8/Test8_RW_Answer_Explanations.docx
- MOCK EXAMS/TEST 9/Test9_Math ANS Explanations.docx
- MOCK EXAMS/TEST 9/Test9_RW_Answer_Explanations FINAL.docx

Archivos Practice Set implicados:

- PRACTICE EXERCISES/EXERCISES MATH/ADVANCED MATH/EQUIVALENT EXPRESSION/ANS Equivalent Expression EASY.pdf
- PRACTICE EXERCISES/EXERCISES MATH/ADVANCED MATH/EQUIVALENT EXPRESSION/ANS HARD 1EQUIV EXPRES .pdf
- PRACTICE EXERCISES/EXERCISES MATH/ADVANCED MATH/EQUIVALENT EXPRESSION/Ans Equivalent Expressions MED.pdf
- PRACTICE EXERCISES/EXERCISES MATH/ADVANCED MATH/NON LINEAR EQUATIONS/ANS Hard 1 Non Linear Equations.pdf
- PRACTICE EXERCISES/EXERCISES MATH/ADVANCED MATH/NON LINEAR EQUATIONS/ANS Non Linear Equations MED.pdf
- PRACTICE EXERCISES/EXERCISES MATH/ADVANCED MATH/NON LINEAR FUNCTIONS/ANS NON LINEAR FUNCT HARD .pdf
- PRACTICE EXERCISES/EXERCISES MATH/ADVANCED MATH/NON LINEAR FUNCTIONS/ANS Non Linear Functions EASY.pdf
- PRACTICE EXERCISES/EXERCISES MATH/ADVANCED MATH/NON LINEAR FUNCTIONS/ANS Non Linear Functions MED.pdf
- PRACTICE EXERCISES/EXERCISES MATH/ADVANCED MATH/NON LINEAR FUNCTIONS/Non Linear Functions EASY.pdf
- PRACTICE EXERCISES/EXERCISES MATH/ALGEBRA/LINEAR EQUATIONS TWO VARIABLES/ANS Linear Eq TWO Variables EASY.pdf
- PRACTICE EXERCISES/EXERCISES MATH/ALGEBRA/LINEAR EQUATIONS TWO VARIABLES/ANS Linear Eq TWO Variables HARD.pdf
- PRACTICE EXERCISES/EXERCISES MATH/ALGEBRA/LINEAR EQUATIONS TWO VARIABLES/ANS Linear Eq TWO Variables MED.pdf
- PRACTICE EXERCISES/EXERCISES MATH/ALGEBRA/LINEAR EQUATIONS TWO VARIABLES/Linear Eq TWO Variables EASY.pdf
- PRACTICE EXERCISES/EXERCISES MATH/ALGEBRA/LINEAR EQUATIONS TWO VARIABLES/Linear Eq TWO Variables HARD.pdf
- PRACTICE EXERCISES/EXERCISES MATH/ALGEBRA/LINEAR EQUATIONS TWO VARIABLES/Linear Eq TWO Variables MED.pdf
- PRACTICE EXERCISES/EXERCISES MATH/ALGEBRA/LINEAR FUNCTIONS/ANS Linear Functions EASY.pdf
- PRACTICE EXERCISES/EXERCISES MATH/ALGEBRA/LINEAR FUNCTIONS/Linear Functions EASY.pdf
- PRACTICE EXERCISES/EXERCISES MATH/ALGEBRA/LINEAR INEQUALITIES/ANS Linear Inequalities EASY.pdf
- PRACTICE EXERCISES/EXERCISES MATH/ALGEBRA/SYSTEMS TWO LINEAR EQUATIONS & EQUATIONS IN TWO VARIABLES/ANS Systems Two Lin Eq. Two Var HARD.pdf
- PRACTICE EXERCISES/EXERCISES MATH/GEOMETRY & TRIGONOMETRY/CIRCLES/ANS Circles HARD.pdf
- PRACTICE EXERCISES/EXERCISES MATH/GEOMETRY & TRIGONOMETRY/LINES ANGLES TRIANGLES/Lines Angles Triangles EASY.pdf
- PRACTICE EXERCISES/EXERCISES MATH/GEOMETRY & TRIGONOMETRY/LINES ANGLES TRIANGLES/Lines Angles Triangles HARD.pdf
- PRACTICE EXERCISES/EXERCISES MATH/GEOMETRY & TRIGONOMETRY/RIGHT TRIANGLES AND TRIGONOMETRY/Right Triangles and Trig EASY.pdf
- PRACTICE EXERCISES/EXERCISES MATH/GEOMETRY & TRIGONOMETRY/RIGHT TRIANGLES AND TRIGONOMETRY/Right Triangles and Trig HARD.pdf
- PRACTICE EXERCISES/EXERCISES MATH/GEOMETRY & TRIGONOMETRY/RIGHT TRIANGLES AND TRIGONOMETRY/Right Triangles and Trig.pdf
- PRACTICE EXERCISES/EXERCISES MATH/PROBLEM SOLVING DATA ANALYSIS/DATA AND MEAN/Data Distribut, mean ANS HARD.pdf
- PRACTICE EXERCISES/EXERCISES MATH/PROBLEM SOLVING DATA ANALYSIS/DATA AND MEAN/Data Distribut, mean Hard.pdf
- PRACTICE EXERCISES/EXERCISES MATH/PROBLEM SOLVING DATA ANALYSIS/ONE VARIABLE DATA/ANS One Var. Data EASY.pdf
- PRACTICE EXERCISES/EXERCISES MATH/PROBLEM SOLVING DATA ANALYSIS/ONE VARIABLE DATA/ANS One Var. Data HARD.pdf
- PRACTICE EXERCISES/EXERCISES MATH/PROBLEM SOLVING DATA ANALYSIS/ONE VARIABLE DATA/ANS One Var. Data MED.pdf
- PRACTICE EXERCISES/EXERCISES MATH/PROBLEM SOLVING DATA ANALYSIS/PROBABILITY/ANS Probability HARD.pdf
- PRACTICE EXERCISES/EXERCISES MATH/PROBLEM SOLVING DATA ANALYSIS/RATIOS RATES PROPORTIONS UNITS/ANS Ratios Rates Propo Units EASY .pdf
- PRACTICE EXERCISES/EXERCISES READING/COMMAND EVIDENCE/ANS CE HARD.pdf
- PRACTICE EXERCISES/EXERCISES READING/COMMAND EVIDENCE/ANS CE MED.pdf
- PRACTICE EXERCISES/EXERCISES READING/COMMAND EVIDENCE/ANS COMMAND EVIDENCE EASY.pdf

También existe una incidencia abierta sin archivo asociado.

## Eventos de procesamiento

Hay 266 registros en IngestJobEvent. Estados no terminales persistidos:

| Tipo | Estado | Total | Rango de creación |
| --- | --- | ---: | --- |
| PROCESS | RUNNING | 42 | 2026-08-08 |
| PROCESS | STARTED | 3 | 2026-08-08 |
| REHYDRATE_FULL_TEST_DOCX | RUNNING | 29 | 2026-08-03 a 2026-08-04 |
| REHYDRATE_FULL_TEST_DOCX | STARTED | 11 | 2026-08-03 a 2026-08-04 |
| RETRY_OCR | RUNNING | 35 | 2026-08-03 |
| RETRY_OCR | STARTED | 2 | 2026-08-03 |

También hay eventos COMPLETED de PROCESS, REHYDRATE_FULL_TEST_DOCX, RETRY_OCR,
MANUAL_CROP_ASSIGN, MANUAL_CROP_OCR y OPTION_IMAGE_OCR.

## Respaldos

- Cron: 0 */6 * * *, ejecuta /usr/local/bin/sat-db-backup.sh.
- Usa sqlite3 .backup, conserva copias locales y sube a
  gs://sat-sol-gsc-sat-data/backups/.
- Hay 24 copias dev-*.db locales observables; la más reciente es
  dev-2026-09-13-1800.db, de aproximadamente 84 MB.
- GCS reportó 154 objetos de respaldo, aproximadamente 12.21 GiB.
- El script elimina copias dev-*.db de más de 3 días; los históricos pre-push-*
  no siguen esa misma nomenclatura de limpieza.

## Red y seguridad observada

- sat-allow-http: TCP 80 y 443 desde Internet, limitado a sat-web.
- sat-allow-ssh-iap: TCP 22 desde el rango IAP 35.235.240.0/20.
- default-allow-ssh y default-allow-rdp están habilitadas desde 0.0.0.0/0;
  SSH y RDP quedan expuestos públicamente y deben corregirse.
- default-allow-icmp también está abierto a Internet.

En logs recientes se observaron errores de Next.js Failed to find server action
con referencia inválida y desconexiones de reverse proxy de Caddy. Los health
checks internos siguieron respondiendo correctamente; son señales para revisar,
no evidencia de caída total.

## Pausa de la instancia

La instancia se detuvo después de capturar este documento con:

gcloud compute instances stop sat-vm --zone=us-east1-b --project=sat-sol-gsc

Verificación posterior: sat-vm quedó en estado TERMINATED.

La pausa conserva sat-data, la base, uploads, artefactos, configuración de Caddy,
imágenes Docker y respaldos. Para volver a levantar la VM:

gcloud compute instances start sat-vm --zone=us-east1-b --project=sat-sol-gsc

Al arrancar, el startup script vuelve a montar /data, carga configuración desde
el bucket, recupera secretos desde Secret Manager y levanta el Compose productivo.
La IP externa puede cambiar si no existe una reserva estática.

