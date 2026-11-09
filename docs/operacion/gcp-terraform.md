# Acceso a GCP y Terraform

[Índice de operación](README.md) · [Índice general](../README.md)

```bash
gcloud auth login
gcloud auth application-default login
gcloud config set project sat-sol-gsc
gcloud auth list
gcloud projects describe sat-sol-gsc
```

CLI y ADC son credenciales distintas. El Makefile usa un token de la cuenta CLI activa.
Se necesita acceso al bucket de estado, IAP/SSH/Compute, Cloud Build y su service account,
Artifact Registry, buckets y Secret Manager según la operación; un 403 requiere revisar
el permiso concreto, no conceder Owner. Consultar [CI y federación de identidad](../../deploy/docs/ci-wif.md).

Terraform en Docker (desde deploy, Bash):

```bash
docker pull hashicorp/terraform:1.9.8
export GOOGLE_OAUTH_ACCESS_TOKEN="$(gcloud auth print-access-token)"
docker run --rm -e GOOGLE_OAUTH_ACCESS_TOKEN -v "$PWD:/work" -w /work/terraform/environments/prod hashicorp/terraform:1.9.8 init -input=false
unset GOOGLE_OAUTH_ACCESS_TOKEN
```

En PowerShell usar `$env:GOOGLE_OAUTH_ACCESS_TOKEN = gcloud auth print-access-token`,
`-v "${PWD}:/work"` y limpiar con `Remove-Item Env:GOOGLE_OAUTH_ACCESS_TOKEN` en finally.
Repetir el contenedor con `plan -var-file=prod.tfvars -out=prod.plan`, y revisar el plan
antes de `apply prod.plan`. Nunca aplicar destroy/replace. No ejecutar bootstrap para
acceder a producción existente. `init` descarga estado/proveedores, no código desplegado.

## Recursos directos

- [Configuración de producción](../../deploy/terraform/environments/prod/prod.tfvars)
- [Estado y proveedores Terraform](../../deploy/terraform/environments/prod/versions.tf)
- [Importación de infraestructura](../../deploy/docs/import.md)
- [CI y federación de identidad](../../deploy/docs/ci-wif.md)
- [Comandos make](../../deploy/Makefile)
