# Desarrollo local

[Índice de operación](README.md) · [Índice general](../README.md)

Clonar la URL del repositorio y entrar a su raíz. Ejecutar `bash deploy/scripts/doctor.sh`
o `pwsh -File deploy/scripts/doctor.ps1`. Un fallo requiere corregir el requisito y repetir.

```bash
cp .env.example .env
npm ci
npm run prisma:generate
npx prisma migrate deploy
npm run db:seed
npx playwright install chromium
python3 -m venv .venv
.venv/bin/python -m pip install -r ingest_service/requirements.txt
docker compose up -d
```

En PowerShell sustituir `cp` por `Copy-Item`, `python3` por `py -3.12` y
`.venv/bin/python` por `.venv/Scripts/python.exe`. Los comandos npm y Docker son iguales.
En Linux, `npx playwright install --with-deps chromium` instala bibliotecas del navegador.
La imagen Python ya instala build-essential, libgl1 y libglib2.0-0.
Generar secretos locales con `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"`
y configurar AUTH_SECRET, SECRET_ENCRYPTION_KEY e INTERNAL_INGEST_TOKEN en `.env`.
Nunca ejecutar seed/reset sobre una copia de producción que se deba conservar.
Web: http://localhost:3000; ingesta: http://localhost:8000; emulador GCS: puerto 4443.

## Recursos directos

- [Variables de entorno](../../.env.example)
- [Compose local](../../docker-compose.yml)
- [Pruebas E2E](../../e2e/README.md)
- [Data patches](../../prisma/data-patches/README.md)
