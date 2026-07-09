# Setup de Correo SMTP (Listo para Producción y Desarrollo)

Esta guía deja funcionando los correos transaccionales de:

- Invitación de estudiante/padre
- Consentimiento parental
- Recuperación de contraseña

El proyecto usa `nodemailer` y espera variables `EMAIL_*`.

---

## 1) Crear cuenta SMTP (recomendado: Brevo)

1. Crea una cuenta en [Brevo](https://www.brevo.com/).
2. Entra a **SMTP & API** y habilita SMTP.
3. Crea/obtén las credenciales SMTP:
   - Host: `smtp-relay.brevo.com`
   - Puerto: `587` (TLS STARTTLS) o `465` (SSL)
   - Usuario SMTP
   - Password/API key SMTP
4. Verifica un remitente (sender) en Brevo:
   - Ejemplo: `noreply@tudominio.com`
   - Este correo debe coincidir con `EMAIL_FROM`.

> Sin remitente verificado, Brevo puede rechazar el envío.

---

## 2) Configurar `.env` correctamente

En este proyecto, **las variables válidas son `EMAIL_*`** (no `SMTP_*`).

Actualiza `.env` así:

```env
AUTH_URL="http://localhost:3000"

EMAIL_FROM="noreply@tudominio.com"
EMAIL_HOST="smtp-relay.brevo.com"
EMAIL_PORT="587"
EMAIL_USER="tu-smtp-user"
EMAIL_PASS="tu-smtp-pass-o-api-key"
```

Notas:

- `EMAIL_FROM` debe estar verificado en Brevo.
- Si usas puerto `465`, el código activa `secure: true` automáticamente.
- Si faltan `EMAIL_HOST`, `EMAIL_USER` o `EMAIL_PASS`, el sistema entra en modo:
  - `[EMAIL:SKIPPED] SMTP not configured`

---

## 3) Reiniciar servidor de la app

Después de cambiar `.env`:

1. Detén el servidor `next dev` si está corriendo.
2. Inícialo de nuevo:

```bash
npm run dev
```

---

## 4) Verificar conexión SMTP (sin enviar a usuarios)

Ejecuta este comando desde la raíz del proyecto:

```bash
node -e "require('dotenv').config(); const req=['EMAIL_HOST','EMAIL_FROM','EMAIL_USER','EMAIL_PASS']; const miss=req.filter(k=>!process.env[k]); if(miss.length){console.log('FALTAN:',miss.join(',')); process.exit(1);} const nodemailer=require('nodemailer'); const port=Number(process.env.EMAIL_PORT||587); const t=nodemailer.createTransport({host:process.env.EMAIL_HOST,port,secure:port===465,auth:{user:process.env.EMAIL_USER,pass:process.env.EMAIL_PASS}}); t.verify().then(()=>console.log('SMTP_VERIFY_OK')).catch(e=>{console.error('SMTP_VERIFY_FAIL',e.message); process.exit(1);});"
```

Esperado:

- `SMTP_VERIFY_OK`

Si falla:

- revisa host/puerto/credenciales
- revisa firewall/red corporativa
- confirma que el sender (`EMAIL_FROM`) está verificado

---

## 5) Verificación funcional end-to-end

## 5.1 Invitación de estudiante

1. Entra como `TEACHER` o `ADMIN`.
2. Ve a invitar estudiante.
3. Envía invitación con un correo real de prueba.
4. Revisa bandeja del destinatario.

Esperado:

- Llega correo "Activate your SAT Practice account".
- Link abre `/auth/activate?token=...`.

## 5.2 Forgot password

1. Ve a `/auth/forgot-password`.
2. Solicita reset para un usuario existente.
3. Revisa bandeja.

Esperado:

- Llega correo "Reset your SAT Practice password".
- Link abre `/auth/reset-password?token=...`.

---

## 6) Troubleshooting rápido

- **Veo `[EMAIL:SKIPPED] SMTP not configured`**
  - Faltan variables `EMAIL_HOST`, `EMAIL_USER` o `EMAIL_PASS`.
- **No llega correo, pero no hay error**
  - Revisar carpeta spam/promotions.
  - Revisar límites del plan SMTP.
  - Confirmar dominio/remitente verificado.
- **`SMTP_VERIFY_FAIL`**
  - Credenciales incorrectas o puerto bloqueado.
- **Envío responde OK en API, pero no llega**
  - Ver logs de servidor para `[EMAIL:FAILED]`.

---

## 7) Recomendaciones de producción

- Usar un remitente con dominio propio (`noreply@tu-dominio.com`).
- Configurar SPF/DKIM/DMARC del dominio.
- Rotar credenciales SMTP periódicamente.
- Monitorear tasa de rebote y bloqueos del proveedor SMTP.

