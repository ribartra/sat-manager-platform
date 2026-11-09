# Requisitos e instalación

[Índice de operación](README.md) · [Índice general](../README.md)

Base soportada: Windows 11 x64, PowerShell 7 y Docker Desktop con contenedores Linux;
Ubuntu/Debian x64 con Bash y Docker Engine/Compose. La VM de producción sigue siendo Linux.
`gcloud` es Google Cloud CLI; `gclient` es de Chromium y no se necesita.

Inventario: Git, Node **24** y npm, Python **3.12** con venv/pip, Docker y Compose v2,
Google Cloud CLI, Terraform >=1.9 (CI: 1.9.8), compiladores C++ para better-sqlite3,
OpenSSL y certificados. Linux además usa make, sed, awk, grep, curl, tar, gzip, base64,
coreutils y opcionalmente fuser. Playwright requiere Chromium y sus bibliotecas.
SQLite CLI se usa en la VM; localmente los scripts utilizan better-sqlite3.

### Windows (PowerShell 7)

```powershell
winget install --id Git.Git -e
winget install --id Microsoft.PowerShell -e
winget install --id OpenJS.NodeJS.LTS -e --version 24.11.0
winget install --id Python.Python.3.12 -e
winget install --id Docker.DockerDesktop -e
winget install --id Google.CloudSDK -e
winget install --id Hashicorp.Terraform -e
wsl --install
```

Verificar que el catálogo tenga esa versión de Node; si no, instalar una versión 24.x
desde nodejs.org. Reiniciar cuando WSL lo solicite, abrir Docker Desktop y una terminal nueva.
Si npm debe compilar better-sqlite3, instalar Visual Studio Build Tools con la carga
Desktop development with C++ y Python accesible en PATH. No compartir node_modules entre OS.

### Ubuntu/Debian

```bash
sudo apt-get update
sudo apt-get install -y git curl ca-certificates gnupg make g++ python3 python3-venv python3-pip openssl sqlite3 psmisc
```

Instalar Node 24 desde la distribución oficial y verificar `node --version`.
Instalar Docker Engine y el plugin Compose desde el repositorio oficial de Docker;
instalar Google Cloud CLI desde su repositorio apt oficial. No mezclar docker.io con
paquetes Docker CE. Python debe ser 3.12 para reproducir el contenedor de ingesta.

Fuentes y pasos por distribución:
- [Google Cloud CLI](https://docs.cloud.google.com/sdk/docs/install-sdk)
- [Docker Ubuntu](https://docs.docker.com/engine/install/ubuntu/)
- [Docker Windows](https://docs.docker.com/desktop/setup/install/windows-install/)
- [Terraform](https://developer.hashicorp.com/terraform/tutorials/aws-get-started/install-cli)
- [Node](https://nodejs.org/en/download)

## Recursos directos

- [Doctor Bash](../../deploy/scripts/doctor.sh)
- [Doctor PowerShell](../../deploy/scripts/doctor.ps1)
- [Dependencias web](../../package.json)
- [Dependencias de ingesta](../../ingest_service/requirements.txt)
