# Diagnóstico de problemas

[Índice de operación](README.md) · [Índice general](../README.md)

| Síntoma | Evidencia y acción |
|---|---|
| gcloud no encontrado | Revisar PATH, reabrir terminal y ejecutar gcloud version |
| 401/403 GCP | Revisar cuenta/proyecto, renovar login y revisar permiso del recurso |
| SSH/IAP falla | Revisar acceso IAP, Compute/SSH y firewall; no abrir puerto 22 público |
| Docker no responde | Arrancar daemon/Desktop, verificar contexto y docker info |
| npm falla en Windows | Revisar paquetes por plataforma y toolchain C++; reinstalar con npm ci |
| ingesta no ve configuración | DATABASE_URL absoluto compartido y claves/tokens coherentes |
| web no arranca tras release | Revisar logs de migraciones/data patches antes del rollback |
| backup devuelve 503 | Revisar /var/log/sat-db-backup.log y antigüedad del último backup |
| 5xx | Correlacionar requestId en Cloud Logging y ERROR_CAUGHT |
| Caddy falla tras sync | Validar configuración y montaje de carpeta; ver incidente del runbook |

## Recursos directos

- [Runbook y consultas de logs](../../deploy/docs/runbook.md)
- [Configuración de Ops Agent](../../deploy/vm/ops-agent.yaml)
- [Compose de producción](../../deploy/vm/docker-compose.prod.yml)
- [Backup en VM](../../deploy/vm/sat-db-backup.sh)
