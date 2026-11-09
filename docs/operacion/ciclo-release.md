# Del incidente al redespliegue

[Índice de operación](README.md) · [Índice general](../README.md)

1. Registrar hora/zona, URL, rol, pasos, resultado esperado, error y x-request-id.
2. Desde deploy: `make current`, `make health`, `make ssh`. En Windows consultar la
   [guía de compatibilidad](compatibilidad.md) antes de usar scripts. En la VM, ejecutar desde /data/stack:
   `sudo docker compose -p sat-platform --env-file .env ps` y
   `sudo docker compose -p sat-platform --env-file .env logs --since 30m --tail 200 web ingest-service caddy`.
3. Consultar `gcloud logging read 'jsonPayload.requestId="ID"' --project sat-sol-gsc --limit 100`.
   Filtrar 5xx con `jsonPayload.event="http.request" jsonPayload.status>=500`.
   No copiar secretos ni datos personales a issues.
4. `make pull-db` crea backup consistente remoto y reemplaza dev.db local: detener primero
   servidores locales. Se eliminan ajustes cifrados incompatibles con la clave local.
   `make db-compare` compara sin reemplazar la base local. Los medios no vienen con la DB;
   configurar el emulador o copiar los objetos necesarios a un entorno local separado.
5. Consultar Artifact Registry para las imágenes web/ingest del TAG actual; autenticar Docker
   con `gcloud auth configure-docker us-central1-docker.pkg.dev` antes del pull.
   Reproducir con copia aislada y claves locales, nunca montando la DB real en pruebas.
6. Corregir código o añadir data patches conforme a prisma/data-patches/README.md.
   No editar patches aplicados ni ejecutar UPDATE manual en la VM.
7. Ejecutar `npm run quality`, pruebas E2E relevantes sobre base aislada, `make preflight` y
   `docker build -t sat-web:test .` / `docker build -f ingest_service/Dockerfile -t sat-ingest:test .`.
8. `make build` construye ambas imágenes en Cloud Build desde el working tree. Conservar el
   TAG inmutable impreso. `make release TAG=...` realiza backup, pull y health con rollback.
9. Revisar health, backup, logs y flujo afectado. `make rollback` revierte imagen; una migración
   incompatible puede requerir restaurar DB según deploy/docs/runbook.md.

`make sync-stack` instala hacia la VM los archivos publicados por Terraform; no descarga
producción. Cambiar vm/* requiere plan → revisión → apply → sync-stack. Migraciones requieren
ventana de mantenimiento. GitHub construye imágenes, pero no realiza release automático.

## Recursos directos

- [CI/CD: validaciones, imágenes y release manual](ci-cd.md)

- [Runbook: despliegue, rollback y restauración](../../deploy/docs/runbook.md)
- [Descargar base de producción](../../deploy/scripts/pull-db-from-prod.sh)
- [Comparar bases](../../deploy/scripts/compare-with-prod.sh)
- [Construir imágenes](../../deploy/scripts/build-and-push.sh)
- [Release y rollback](../../deploy/scripts/release.sh)
- [Sincronizar stack hacia VM](../../deploy/scripts/sync-stack.sh)
- [Pipeline Cloud Build](../../deploy/cloudbuild.yaml)
