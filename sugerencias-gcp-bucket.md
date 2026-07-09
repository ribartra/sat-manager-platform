````md
# Sugerencias para almacenamiento de imágenes en desarrollo con `fake-gcs-server`

## Contexto

El proyecto está desarrollado en **Next.js con TypeScript** y el despliegue final será en **GCP**.  
Para producción se recomienda usar **Google Cloud Storage**, mientras que para desarrollo local se puede usar **fake-gcs-server** como emulador de Cloud Storage.

La idea es mantener una arquitectura similar a producción sin depender siempre de un bucket real durante desarrollo.

---

## Recomendación general

Usar:

- **Producción:** Google Cloud Storage
- **Desarrollo local:** fake-gcs-server
- **Librería en Next.js:** `@google-cloud/storage`
- **Patrón recomendado:** signed URLs para subir y recuperar imágenes

Esto permite que la aplicación use casi la misma lógica en local y en producción.

---

## Arquitectura sugerida

```txt
Next.js App
  └── API Route / Server Action
        └── usa @google-cloud/storage
              └── en local apunta a fake-gcs-server
              └── en producción apunta a Google Cloud Storage
````

Para el usuario final, el flujo sería:

```txt
Usuario selecciona imagen
  ↓
Next.js genera URL de subida
  ↓
El navegador sube la imagen al bucket/emulador
  ↓
La app guarda el objectName en la base de datos
  ↓
La imagen se recupera por URL firmada o ruta pública
```

---

## Docker Compose sugerido

```yaml
version: "3.8"

services:
  fake-gcs-server:
    image: fsouza/fake-gcs-server
    container_name: fake-gcs-server
    command: ["-scheme", "http", "-port", "4443", "-public-host", "localhost:4443"]
    ports:
      - "4443:4443"
    volumes:
      - ./data/fake-gcs:/storage
```

Esto levanta un servidor local compatible con la API de Google Cloud Storage en:

```txt
http://localhost:4443
```

---

## Variables de entorno sugeridas

Para desarrollo local:

```env
NODE_ENV=development

GCP_BUCKET_NAME=dev-images

GCS_API_ENDPOINT=http://localhost:4443
GCS_PROJECT_ID=local-dev
```

Para producción:

```env
NODE_ENV=production

GCP_BUCKET_NAME=prod-images
GCP_PROJECT_ID=mi-proyecto-gcp
```

En producción no deberías usar `GCS_API_ENDPOINT`. La librería debería conectarse directamente a Google Cloud Storage.

---

## Cliente reutilizable para Next.js

Crear un archivo:

```txt
src/lib/storage.ts
```

Contenido sugerido:

```ts
import { Storage } from "@google-cloud/storage";

const isDev = process.env.NODE_ENV !== "production";

export const storage = new Storage({
  projectId: process.env.GCS_PROJECT_ID || "local-dev",
  apiEndpoint: isDev ? process.env.GCS_API_ENDPOINT : undefined,
});

export const bucketName = process.env.GCP_BUCKET_NAME!;

export const bucket = storage.bucket(bucketName);
```

De esta forma, el resto del código no necesita saber si está trabajando contra fake-gcs-server o contra Google Cloud Storage real.

---

## Crear bucket local en desarrollo

fake-gcs-server no siempre crea automáticamente el bucket que necesitas. Puedes crear un pequeño script de inicialización.

```txt
scripts/create-local-bucket.ts
```

```ts
import { storage, bucketName } from "../src/lib/storage";

async function main() {
  const [exists] = await storage.bucket(bucketName).exists();

  if (!exists) {
    await storage.createBucket(bucketName);
    console.log(`Bucket creado: ${bucketName}`);
  } else {
    console.log(`Bucket ya existe: ${bucketName}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

Script en `package.json`:

```json
{
  "scripts": {
    "gcs:init": "tsx scripts/create-local-bucket.ts"
  }
}
```

Instalar `tsx` si no lo tienes:

```bash
npm install -D tsx
```

Ejecutar:

```bash
npm run gcs:init
```

---

## API Route para subir imagen

Ruta sugerida:

```txt
src/app/api/images/upload/route.ts
```

Ejemplo simple para desarrollo:

```ts
import { NextRequest, NextResponse } from "next/server";
import { bucket } from "@/lib/storage";
import crypto from "crypto";

const allowedTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export async function POST(req: NextRequest) {
  const formData = await req.formData();

  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Archivo no enviado" },
      { status: 400 }
    );
  }

  if (!allowedTypes.has(file.type)) {
    return NextResponse.json(
      { error: "Tipo de imagen no permitido" },
      { status: 400 }
    );
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || "bin";
  const objectName = `images/${crypto.randomUUID()}.${extension}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  await bucket.file(objectName).save(buffer, {
    contentType: file.type,
    resumable: false,
  });

  return NextResponse.json({
    objectName,
    path: `/api/images/${encodeURIComponent(objectName)}`,
  });
}
```

Este enfoque sube la imagen pasando por el backend de Next.js. Es más simple para desarrollo.

Para producción de alto tráfico, sería mejor usar signed URLs y subir directo desde el navegador al bucket.

---

## API Route para recuperar imagen

Ruta sugerida:

```txt
src/app/api/images/[...path]/route.ts
```

Ejemplo:

```ts
import { NextRequest, NextResponse } from "next/server";
import { bucket } from "@/lib/storage";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;

  const objectName = path.join("/");

  if (!objectName.startsWith("images/")) {
    return NextResponse.json(
      { error: "Ruta inválida" },
      { status: 400 }
    );
  }

  const file = bucket.file(objectName);
  const [exists] = await file.exists();

  if (!exists) {
    return NextResponse.json(
      { error: "Imagen no encontrada" },
      { status: 404 }
    );
  }

  const [buffer] = await file.download();
  const [metadata] = await file.getMetadata();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": metadata.contentType || "application/octet-stream",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
```

---

## Flujo desde el frontend

Ejemplo de subida:

```ts
async function uploadImage(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/images/upload", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Error al subir imagen");
  }

  return response.json();
}
```

Uso:

```ts
const result = await uploadImage(file);

console.log(result.objectName);
console.log(result.path);
```

Luego puedes guardar `objectName` en tu base de datos.

---

## Qué guardar en la base de datos

No se recomienda guardar la URL completa generada en desarrollo.
Es mejor guardar una referencia estable.

Ejemplo:

```json
{
  "id": "123",
  "userId": "456",
  "objectName": "images/8d6d2d8a-41c7-4a8c.webp",
  "contentType": "image/webp",
  "createdAt": "2026-06-08T00:00:00.000Z"
}
```

Luego tu aplicación decide cómo recuperar esa imagen según el entorno.

---

## Convención recomendada para nombres de objetos

Usar rutas organizadas:

```txt
images/{userId}/{uuid}.webp
```

Ejemplo:

```txt
images/user_123/af31c2e9-6d55-4c78-bf1e.webp
```

Ventajas:

* Evita colisiones de nombres.
* Permite agrupar imágenes por usuario o entidad.
* Facilita limpieza posterior.
* Evita depender del nombre original del archivo.

---

## Validaciones mínimas

Antes de guardar una imagen, validar:

* Tipo MIME permitido.
* Tamaño máximo.
* Extensión coherente.
* Usuario autenticado.
* Que el usuario tenga permiso para subir esa imagen.
* Que el `objectName` generado no venga directamente del cliente.

Ejemplo de tipos permitidos:

```ts
const allowedTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
```

Ejemplo de tamaño máximo:

```ts
const maxSize = 5 * 1024 * 1024; // 5 MB

if (file.size > maxSize) {
  throw new Error("La imagen supera el tamaño máximo permitido");
}
```

---

## Sugerencia para producción

En producción no conviene que todas las imágenes pasen por el backend de Next.js si los archivos pueden ser grandes o muchos.

Mejor usar:

```txt
Cliente
  ↓
Pide signed URL a Next.js
  ↓
Sube imagen directo a Google Cloud Storage
  ↓
Next.js guarda metadata en BD
```

Esto reduce carga en el servidor y mejora escalabilidad.

---

## Diferencia entre desarrollo y producción

| Punto        | Desarrollo              | Producción                          |
| ------------ | ----------------------- | ----------------------------------- |
| Storage      | fake-gcs-server         | Google Cloud Storage                |
| Endpoint     | `http://localhost:4443` | Endpoint oficial de GCP             |
| Credenciales | No críticas / locales   | Service Account / Workload Identity |
| Bucket       | `dev-images`            | `prod-images`                       |
| Subida       | Puede pasar por Next.js | Mejor con signed URL                |
| Persistencia | Volumen Docker          | Bucket real                         |

---

## Recomendaciones finales

1. Usar `fake-gcs-server` solo como emulador local.
2. Mantener la librería `@google-cloud/storage` en todo el proyecto.
3. Crear una capa propia `src/lib/storage.ts`.
4. Guardar solo `objectName` en la base de datos.
5. Usar rutas como `images/{userId}/{uuid}.webp`.
6. En desarrollo puedes subir por API Route simple.
7. En producción migrar a signed URLs.
8. No depender de URLs locales generadas por fake-gcs-server.
9. No exponer buckets públicos por defecto.
10. Mantener buckets separados para desarrollo, staging y producción.

---

## Estructura sugerida del proyecto

```txt
src/
  app/
    api/
      images/
        upload/
          route.ts
        [...path]/
          route.ts
  lib/
    storage.ts
scripts/
  create-local-bucket.ts
data/
  fake-gcs/
docker-compose.yml
.env.local
```

---

## Comandos útiles

Levantar fake-gcs-server:

```bash
docker compose up -d
```

Crear bucket local:

```bash
npm run gcs:init
```

Subir imagen desde la app:

```txt
POST /api/images/upload
```

Recuperar imagen:

```txt
GET /api/images/images/{uuid}.webp
```

---

## Decisión recomendada

Para este proyecto:

```txt
Desarrollo local:
fake-gcs-server + @google-cloud/storage

Producción:
Google Cloud Storage + @google-cloud/storage

Patrón:
Guardar objectName en BD y usar API propia o signed URLs para acceso
```

Esta ruta permite desarrollar localmente sin pagar ni depender de GCP todo el tiempo, pero manteniendo una transición simple hacia producción.

```
```

