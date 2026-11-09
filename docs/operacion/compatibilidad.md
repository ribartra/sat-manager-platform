# Compatibilidad y validación pendiente

[Índice de operación](README.md) · [Índice general](../README.md)

Los scripts de VM permanecen Bash. Los equivalentes PowerShell de operaciones de despliegue
requieren validación antes de considerarse soporte nativo completo. No ejecutar operaciones
mutantes en producción para verificar documentación. Las pruebas E2E crean/modifican datos:
no apuntarlas a producción. El preflight no necesita credenciales pero puede descargar providers
Terraform e imágenes, por lo que requiere red y Docker para cobertura completa.

## Recursos directos

- [Preflight](../../deploy/scripts/preflight.sh)
- [CI actual](../../.github/workflows/ci.yml)
- [Instrucciones del agente](../../CLAUDE.md)
