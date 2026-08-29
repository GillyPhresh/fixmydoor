# FixMyDoor Railway Deployment Guide

This project deploys as one full-stack Railway service:

- Public website: `/`
- Admin dashboard: `/admin`
- Customer tracking pages: `/track/:token`
- Backend API: `/api/*`
- SQLite database: stored on a Railway volume

## 1. What Railway Plan Can Be Used?

Railway has a Free plan/trial option for small apps. The free/trial limits can change, so confirm the current limits in Railway before relying on it for production. For a preview website, the Free plan/trial is suitable if the app stays within the included monthly credits and storage limits.

## 2. Push Code To GitHub

Do not commit `.env`.

```powershell
git add .
git commit -m "Prepare FixMyDoor for Railway deployment"
git push
```

## 3. Create Railway Project

1. Go to Railway.
2. Click `New Project`.
3. Choose `Deploy from GitHub repo`.
4. Select the FixMyDoor repository.
5. Railway will use `railway.json` and the `Dockerfile`.

Railway will build the frontend and backend into one Node app.

## 4. Add A Persistent Volume For SQLite

Bookings, reviews, admin users, and dashboard content are stored in SQLite. Railway containers are recreated during deploys, so the database must be on a persistent volume.

1. In the Railway project canvas, add a volume to the app service.
2. Mount the volume at:

```text
/data
```

3. Set `DATABASE_URL` to:

```text
file:/data/fixmydoor.db
```

This keeps the database outside the temporary app filesystem.

## 5. Add Railway Environment Variables

In Railway, open the app service, then go to `Variables`.

Required:

```env
NODE_ENV="production"
DATABASE_URL="file:/data/fixmydoor.db"
SESSION_SECRET="generate-a-long-random-secret-at-least-32-characters"
```

First admin account:

```env
CREATE_DEFAULT_ADMIN="true"
DEFAULT_ADMIN_USERNAME="admin"
DEFAULT_ADMIN_PASSWORD="Use-A-Strong-Private-Password123"
```

Email sending:

Use either Resend or SMTP.

Resend option:

```env
RESEND_API_KEY="re_xxxxxxxxx"
RESEND_FROM_EMAIL="FixMyDoor Services <booking@fixmydoor.ca>"
ADMIN_EMAIL="booking@fixmydoor.ca"
BUSINESS_EMAIL="booking@fixmydoor.ca"
```

Use Resend after the domain is verified in Resend. Railway can still use Gmail SMTP while waiting for the domain approval.

SMTP fallback option:

```env
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="info.fixmydoor@gmail.com"
SMTP_PASS="your-gmail-app-password"
FROM_EMAIL="FixMyDoor Services <booking@fixmydoor.ca>"
BUSINESS_EMAIL="booking@fixmydoor.ca"
ADMIN_EMAIL="booking@fixmydoor.ca"
```

For Resend, verify your sending domain in Resend after the domain DNS is live.

After Railway gives you a public URL, add:

```env
PUBLIC_SITE_URL="https://your-railway-url.up.railway.app"
ADMIN_URL="https://your-railway-url.up.railway.app/admin"
```

Important: `SMTP_PASS` must be a Gmail App Password, not the normal Gmail login password.

## 6. Deploy

Railway should automatically deploy after you push to GitHub.

During startup, the app runs Prisma migrations automatically when `NODE_ENV=production`.

Useful pages after deploy:

```text
https://your-railway-url.up.railway.app/
https://your-railway-url.up.railway.app/admin
https://your-railway-url.up.railway.app/api/health
```

## 7. Test Before Sharing

Test these:

- Open the public homepage.
- Submit one booking request.
- Confirm the business email receives the booking.
- Confirm the customer email receives the confirmation.
- Open `/admin`.
- Log in with the admin username/password.
- Confirm the booking appears in the dashboard.
- Change the booking status and confirm the customer receives a status update email.
- Add a review and approve it from admin.

## 8. Security Notes

- Do not commit `.env`.
- Do not put Gmail passwords in GitHub.
- Use a strong `SESSION_SECRET`.
- Use a strong admin password.
- Keep the Railway volume attached. Without it, SQLite data can be lost on redeploy.
- After confirming the admin account exists, you may change `CREATE_DEFAULT_ADMIN` to `"false"`.

## 9. When Ready For A Domain

In Railway:

1. Open the app service.
2. Go to `Settings` or `Networking`.
3. Add your custom domain.
4. Update DNS as Railway instructs.
5. Update these Railway variables:

```env
PUBLIC_SITE_URL="https://www.fixmydoor.ca"
ADMIN_URL="https://www.fixmydoor.ca/admin"
```

In CanSpace:

1. Add the DNS records Railway gives you for both `fixmydoor.ca` and `www.fixmydoor.ca`.
2. Make sure `www.fixmydoor.ca` is connected to the same Railway service. The app treats `https://www.fixmydoor.ca` as the canonical public website.
3. Add the DNS records Resend gives you for email sending, usually SPF, DKIM, and DMARC records.
4. Wait until both Railway and Resend show the domain as verified.

In Resend:

1. Add `fixmydoor.ca` as a sending domain.
2. Verify the DNS records in CanSpace.
3. Set this in Railway after verification:

```env
RESEND_API_KEY="re_xxxxxxxxx"
RESEND_FROM_EMAIL="FixMyDoor Services <booking@fixmydoor.ca>"
```

Do not use a `@fixmydoor.ca` sender in Railway until Resend says the domain is verified.
