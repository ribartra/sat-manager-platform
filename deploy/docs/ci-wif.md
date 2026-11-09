# GitHub Actions → GCP (Workload Identity Federation)

El workflow `.github/workflows/build-images.yml` construye las imágenes en Cloud Build sin llaves
JSON. Usa un token OIDC de GitHub que solo vale para `ribartra/sat-manager-platform`.

Flujo completo, comprobaciones y limitaciones: [guía de CI/CD](../../docs/operacion/ci-cd.md).

## Qué crea Terraform (`modules/ci`)

- **Pool `github` y proveedor `github-actions`**, con la condición
  `assertion.repository == 'ribartra/sat-manager-platform'`.
- **SA `sat-github-ci`.** Solo puede:
  - lanzar builds (`cloudbuild.builds.editor`, `serviceUsageConsumer`, `logging.viewer`);
  - ejecutarlos como `cloudbuild-web` (`serviceAccountUser` sobre esa SA);
  - subir el código al bucket `sat-sol-gsc_cloudbuild`;
  - leer Artifact Registry.

  No puede desplegar en la VM ni cambiar infraestructura.

## Configurar GitHub (una vez, después de `make apply`)

En *Settings → Secrets and variables → Actions → Variables* del repositorio:

| Variable | Valor |
|---|---|
| `GCP_PROJECT_ID` | `sat-sol-gsc` |
| `GCP_REGION` | `us-central1` |
| `GCP_WIF_PROVIDER` | `terraform -chdir=terraform/environments/prod output -raw github_wif_provider` |
| `GCP_WIF_SERVICE_ACCOUNT` | `terraform -chdir=terraform/environments/prod output -raw github_ci_service_account` |

Mientras `GCP_WIF_PROVIDER` esté vacía, el workflow solo deja un aviso y no falla.

## Flujo

1. Un push a `main` que toca código de la app o de la ingesta lanza el build. También se puede
   lanzar a mano con *Run workflow*.
2. Las imágenes quedan en `us-central1-docker.pkg.dev/sat-sol-gsc/sat-images/{web,ingest}:<yyyymmdd>-<sha>`.
3. El resumen del run muestra el TAG. Para desplegarlo: `cd deploy && make release TAG=<tag>`.
