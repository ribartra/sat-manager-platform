# Operación en Windows y Linux

[Índice general de documentación](../README.md)

Elige la tarea para acceder a sus instrucciones y recursos. Los comandos de despliegue
actuales usan Bash/make; consulta la compatibilidad antes de operar desde Windows.

| Necesito… | Guía |
|---|---|
| Preparar una PC e identificar herramientas faltantes | [Requisitos e instalación](requisitos.md) |
| Configurar dependencias y ejecutar el proyecto | [Desarrollo local](desarrollo-local.md) |
| Autenticarme y trabajar con el estado de infraestructura | [GCP y Terraform](gcp-terraform.md) |
| Reproducir un incidente, probar y desplegar | [Ciclo de corrección y release](ciclo-release.md) |
| Entender la automatización de CI/CD y sus requisitos | [CI/CD](ci-cd.md) |
| Investigar un error o consultar registros | [Troubleshooting](troubleshooting.md) |
| Revisar soporte por plataforma y verificaciones pendientes | [Compatibilidad](compatibilidad.md) |

## Atajos operativos

- [Runbook: release, rollback, backups y restauración](../../deploy/docs/runbook.md)
- [Entrada de despliegue y propietarios de infraestructura](../../deploy/README.md)
- [Comandos make](../../deploy/Makefile)
- [Doctor Bash](../../deploy/scripts/doctor.sh) · [Doctor PowerShell](../../deploy/scripts/doctor.ps1)
- [Pruebas E2E](../../e2e/README.md) · [Reglas de data patches](../../prisma/data-patches/README.md)

Las guías explican el recorrido; los scripts y el runbook enlazados contienen la
referencia de ejecución. Los scripts de VM se ejecutan en Linux.
