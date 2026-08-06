# Almacenamiento externo en GCS (uploads y staging)

En producción conviene sacar los blobs del filesystem local. Hay **dos niveles**:

## Nivel 1 (recomendado por defecto) — disco persistente + backups a GCS

En el despliegue de VM única (ver `DEPLOY_GCP.md`), `public/uploads` y `.private` viven en
el **disco persistente** de la VM (`/data/uploads`, `/data/private`). Son **same-origin**
(sin fricción con la CSP `img-src 'self'`) y se respaldan a un bucket GCS:

- Config del stack y seed inicial: `gs://<bucket>/stack/*`, `gs://<bucket>/seed/*`.
- Backups diarios de la BD: `gs://<bucket>/backups/dev-*.db` (cron en la VM).
- Snapshots de disco opcionales para punto de retorno completo.

Esto cubre durabilidad sin tocar la aplicación.

## Nivel 2 (opcional) — GCS como storage primario de uploads

El código ya incluye un adapter con dos drivers en `lib/object-storage.ts`:

- `STORAGE_DRIVER=local` (default): escribe en `public/<key>`, sirve en `/<key>`.
- `STORAGE_DRIVER=gcs`: guarda el objeto en el bucket (`GCS_BUCKET`), URL desde
  `GCS_PUBLIC_BASE_URL`.

Para activarlo:

1. `npm i @google-cloud/storage` (dependencia opcional; solo si usas el driver `gcs`).
2. Variables: `STORAGE_DRIVER`, `GCS_BUCKET`, `GCS_PUBLIC_BASE_URL`.
3. **CSP**: con `img-src 'self'` (ver `next.config.ts`) una URL de GCS se bloquea. Opciones:
   - añadir el host del bucket a `img-src`, o
   - servir los bytes por un proxy same-origin (endpoint que hace `objectStorage.get`).
4. La ruta de avatares (`lib/storage.ts`) ya usa el adapter. Migrar las imágenes de
   ingesta promovidas (`lib/ingest-promotion.ts` → `public/uploads/questions`) al adapter es
   trabajo adicional, cubierto por los QA gates (`qa:p0/authz/edge`): aplicarlo con cuidado
   para no romper los patrones que esos scripts verifican.

## Configuración recomendada del bucket

- **Uniform bucket-level access** (sin ACLs por objeto).
- **Versioning** activado (recuperación ante sobrescritura/borrado).
- Acceso desde la VM vía **Service Account** con `roles/storage.objectAdmin` **solo** sobre
  ese bucket (ya lo crea Terraform en `terraform/main.tf`).
- Lifecycle para expirar versiones archivadas (30 días) y controlar coste.
