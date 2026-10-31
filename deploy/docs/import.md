# Importar producción a Terraform (2026-10-31)

## Por qué

La infraestructura de `sat-sol-gsc` se creó con Terraform en agosto, pero ese estado se perdió.
Después se fueron añadiendo cambios a mano: el bucket off-site, las alertas y los ajustes de la VM.

`environments/prod/imports.tf` adopta los recursos existentes **sin recrearlos**. Los bloques
`import` no hacen nada una vez que el recurso ya está en el estado, así que el archivo se queda.

## Qué se importa y qué se crea

**Se importan (42):**
- 9 APIs;
- la SA de la VM y sus permisos de logs y métricas;
- el repositorio `sat-images`, su lector y la SA `cloudbuild-web` con su rol;
- los dos buckets, los 4 objetos `stack/` y los permisos de los buckets;
- los 5 secretos;
- la IP, los 2 firewalls, el disco `sat-data` y la VM;
- el canal de email, los 2 uptime checks, la métrica `sat_http_5xx` y las 3 alertas.

**Se crean:**
- las APIs `sts` y `cloudresourcemanager`;
- acceso de la VM **secreto por secreto**;
- `apply-stack.sh`, `sat-notifications.sh` y `ops-agent.yaml` en `stack/`;
- la federación con GitHub (pool, proveedor y SA `sat-github-ci`) con sus permisos.

**Cambios en sitio esperados en el primer plan (sin recrear nada):**
- **VM:** el `startup-script` de los metadatos. El actual es de septiembre y fija
  `TAG=ws-20260921-question-ui`; si la VM se reiniciaba, volvía a esa imagen.
- **Objetos `stack/`:** pasan a los archivos de `deploy/vm/`.
- **Alertas:** el enlace al runbook pasa a `deploy/docs/runbook.md`.
- **Artifact Registry:** las políticas de limpieza, en modo **dry-run**.

Cualquier `destroy` o `replace` en el plan es un error del código, no algo que aceptar.

## Fijado para no recrear la VM

La VM se queda tal como está en producción:
- disco de arranque `pd-standard` de 20 GB;
- imagen ignorada con `ignore_changes`;
- shielded VM con vTPM e integrity monitoring, sin secure boot;
- `device_name = sat-data`;
- red `default` con la IP `sat-ip`.

## Pendientes manuales (después de verificar)

1. **Permiso de proyecto sobrante.** Quitar el `secretAccessor` a nivel de proyecto de `sat-vm`,
   que ya tiene acceso secreto por secreto:
   ```bash
   gcloud projects remove-iam-policy-binding sat-sol-gsc \
     --member serviceAccount:sat-vm@sat-sol-gsc.iam.gserviceaccount.com --role roles/secretmanager.secretAccessor
   ```
   Antes de hacerlo, comprueba que la VM sigue leyendo los secretos: corre
   `sudo google_metadata_script_runner startup` y verifica que `/data/app.env` está completo.
2. **Reglas `default-allow-ssh` y `default-allow-rdp`.** Están abiertas a `0.0.0.0/0`. El acceso ya
   va por IAP con `sat-allow-ssh-iap`, así que se pueden borrar:
   ```bash
   gcloud compute firewall-rules delete default-allow-ssh default-allow-rdp --project sat-sol-gsc
   ```
3. **Limpieza de Artifact Registry.** Tras revisar en los logs qué borraría el dry-run, pasar
   `registry_cleanup_dry_run = false` en `prod.tfvars`. El repositorio ocupaba ~25 GB.
