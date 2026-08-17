# Public deployment checklist

## 1. MongoDB Atlas

1. Create an Atlas organization/project and a production cluster.
2. Create a database user with a strong generated password and least privileges for the application database.
3. In Network Access, allow the backend host's outbound IP range. Do not allow `0.0.0.0/0` unless temporarily required for a controlled test.
4. Copy the SRV URI, replace its placeholders, and set it as `MONGODB_URI` only in the backend hosting provider's secret UI.
5. Enable automated backups before opening the service to real customers.

## 2. Rotate Gemini credentials

1. In Google AI Studio, revoke the old Gemini key.
2. Create a replacement key restricted to the production project where possible.
3. Set the replacement as `GEMINI_API_KEY` only in the backend hosting provider's secret UI.
4. Keep `GEMINI_MODEL=gemini-3.7-flash` unless an availability test requires a supported replacement.

Never place an Atlas URI, Gemini key, JWT secret, or account password in Git, frontend variables, screenshots, or issue comments.

## 3. Deploy on Render

The root `render.yaml` defines two services:

```text
ai-customer-support-api  → Node/Express backend
ai-customer-support-web  → React/Vite static frontend
```

Before creating the Blueprint, replace both service names in `render.yaml` with globally unique names. Keep the frontend name, because its Render URL is used by CORS.

1. Push this project to a private GitHub repository. Do not commit `backend/.env` or `backend/.env.migration`.
2. In Render Dashboard choose **New → Blueprint**, connect the repository, and accept `render.yaml`.
3. When Render asks for backend secrets, set:

```text
MONGODB_URI=<Atlas URI with a freshly rotated database password>
JWT_SECRET=<new long random secret>
GEMINI_API_KEY=<fresh Gemini key>
CORS_ORIGINS=https://<your-static-service-name>.onrender.com
```

4. For the static frontend set:

```text
VITE_API_BASE_URL=https://<your-api-service-name>.onrender.com
```

Render injects `VITE_API_BASE_URL` during the static-site build. It must be the backend URL with no trailing `/api`.

5. After both services are live, open:

```text
https://<your-api-service-name>.onrender.com/api/health
```

Expected response:

```json
{"success":true,"message":"AI Customer Support API is running"}
```

The Render free plan can spin down after inactivity, so the first request may take longer. Use a paid plan before relying on the application for real-time customer support.

## 4. Production security included

`NODE_ENV=production` makes `CORS_ORIGINS` mandatory. Browser requests from any other origin are denied.

The backend also limits each client IP as follows:

| Endpoint | Limit |
| --- | --- |
| `POST /api/auth/login` | 10 requests / 15 minutes |
| `POST /api/auth/register` | 5 requests / hour |
| `POST /api/conversations/:id/messages` | 15 requests / minute |

Rate-limit responses return HTTP 429 with a Vietnamese error message. The message limiter protects Gemini usage and should be reviewed as usage grows.

## 5. Final public smoke test

On the real Render domains, test registration, login, customer message, Gemini reply, automatic handoff, agent reply, account disable, CORS rejection from an unapproved origin, and rate-limit behavior.
