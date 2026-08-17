# Public deployment: Vercel + Railway

This project is deployed from the `ai-customer-support/` directory of the `cowcut/VTI` repository:

```text
Vercel static frontend: https://support.sudtip.fun
Railway Node API:       https://api.sudtip.fun
MongoDB Atlas:          production database
```

The committed deployment configuration contains no credentials:

```text
vercel.json    Vite frontend build and SPA fallback
railway.json   Express API build, health check, restart policy
```

## 1. Railway: deploy the API

1. In Railway, create a new project and choose **Deploy from GitHub repo**.
2. Select `cowcut/VTI` and create a service from it.
3. In the service settings, set **Root Directory** to:

   ```text
   ai-customer-support
   ```

4. Railway loads `railway.json` from that directory. It will run:

   ```text
   npm ci && npm run build:backend
   npm --prefix backend run start
   ```

   Its deployment health check is `/api/health`.

5. Add these Railway service variables (never commit or share their values):

   ```env
   NODE_ENV=production
   MONGODB_URI=<Atlas production URI>
   JWT_SECRET=<new cryptographically-random secret>
   GEMINI_API_KEY=<active Gemini server key>
   GEMINI_MODEL=gemini-3.7-flash
   CORS_ORIGINS=https://support.sudtip.fun
   ```

6. Deploy and open the generated Railway public domain. Confirm:

   ```text
   https://<railway-domain>/api/health
   ```

   receives HTTP 200 before attaching the custom domain.

7. Add `api.sudtip.fun` under Railway service **Networking / Custom Domain**. Copy the exact DNS record that Railway displays into the DNS provider for `sudtip.fun`.

## 2. Vercel: deploy the frontend

1. In Vercel, create a new project by importing `cowcut/VTI`.
2. Set **Root Directory** to:

   ```text
   ai-customer-support
   ```

3. Vercel loads `vercel.json` and uses the root lockfile/shared dependency installation:

   ```text
   npm ci && npm run build:frontend
   ```

   It publishes `frontend/dist` and provides SPA fallback routing.

4. Before the first production build, add this Vercel environment variable for the Production environment:

   ```env
   VITE_API_BASE_URL=https://api.sudtip.fun
   ```

   Vite embeds this value into the compiled browser assets; redeploy after changing it.

5. Add `support.sudtip.fun` in Vercel **Settings / Domains**. Copy the exact DNS record Vercel displays into the DNS provider.

## 3. DNS and acceptance checks

Create only the DNS records shown by Railway and Vercel:

```text
api.sudtip.fun      -> Railway target shown in its dashboard
support.sudtip.fun  -> Vercel target shown in its dashboard
```

After both providers validate DNS and issue HTTPS certificates, verify:

```text
https://api.sudtip.fun/api/health
https://support.sudtip.fun
```

Then perform a real browser smoke test: register/login, load an existing conversation, send an AI-mode customer message, and confirm CORS permits only `https://support.sudtip.fun`.

## Atlas networking

Railway outbound IPs must be permitted by MongoDB Atlas Network Access. Do not assume a home IP allowlist such as `171.241.70.75/32` permits Railway. For an initial controlled deployment, configure Atlas access according to Railway's current outbound-networking guidance, then restrict it to a supported static egress option when available for the selected Railway plan.

## Security

- Keep `.env` and `.env.migration` local only.
- Do not enter secrets in `vercel.json`, `railway.json`, GitHub, DNS records, or chat.
- Rotate any credential that was exposed outside a secret manager.
- Keep `CORS_ORIGINS` exact; do not use `*` in production.
- Keep Atlas backups and a least-privilege database user enabled.
