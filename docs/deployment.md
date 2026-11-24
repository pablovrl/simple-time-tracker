# Deployment

## Architecture

The application runs in Google Cloud project `simple-time-tracker-514822`:

- **Firebase Hosting** serves the compiled Angular frontend.
- **Cloud Run** runs the NestJS API as the `time-tracker-api` service in
  `southamerica-east1`.
- **Artifact Registry** stores the API's Docker images.
- **Neon** hosts PostgreSQL in São Paulo.
- **Secret Manager** supplies the database connection and Google OAuth client
  secret to the API at runtime.

The frontend is available at
<https://simple-time-tracker-514822.web.app>.

### Requests and authentication

In production, Angular sends API requests to `/api` on the Firebase Hosting
domain. Hosting forwards these requests to Cloud Run without redirecting the
browser. Other frontend routes fall back to Angular's `index.html`.

Google login also uses the Hosting domain, including the callback at
`/api/auth/google/callback`. This keeps authentication and API requests on the
same browser origin, avoiding reliance on third-party cookies.

Firebase Hosting forwards only the `__session` cookie. With
`FIREBASE_HOSTING=true`, the API uses that cookie for both the temporary OAuth
attempt and the authenticated session. Cookies remain HTTP-only, secure, and
`SameSite=Lax`; origin checks still protect write operations.

Local development keeps the API at `http://localhost:3000`, without the `/api`
prefix or Hosting-specific cookie behavior.

## GitHub Actions pipeline

The workflow is defined in `.github/workflows/deploy.yml`.

Pull requests targeting `main` run tests and builds without access to production.
Pushes to `main` and manual workflow runs on `main` also deploy after successful
verification.

### Verification

The `verify` job installs dependencies from the shared lockfile, runs API and
frontend tests, and builds both applications using Node.js 24 and npm 12.2.2.
For deployment runs, the compiled production frontend is saved as a short-lived
GitHub Actions artifact.

### Production deployment

The `deploy` job depends on successful verification and:

1. Downloads the verified frontend artifact.
2. Builds the API's multi-stage Docker image.
3. Authenticates to Google Cloud with temporary credentials.
4. Pushes the image to Artifact Registry under `latest`.
5. Updates Cloud Run using the pushed image's immutable digest.
6. Checks `/api/health` directly on Cloud Run, including database availability.
7. Publishes the frontend and routing configuration to Firebase Hosting.
8. Checks `/api/health` through the Hosting domain.

Only the `latest` image tag is pushed. Deploying by digest ensures Cloud Run
executes the exact image built by that run, rather than resolving a mutable tag
later. Older untagged images and Cloud Run revisions can remain; the workflow
does not perform cleanup.

Deployments share a concurrency group, so only one deployment job runs at a
time. An active deployment is not cancelled by a newer run.

## Deployment identity

GitHub authenticates through OpenID Connect and Google Cloud Workload Identity
Federation. The provider trusts only the immutable repository and owner IDs for
`pablovrl/simple-time-tracker`, with push or manual events on `main`.

The `github-deploy` service account can upload images, update Cloud Run, publish
Hosting, and deploy using the API's existing runtime service account. No
long-lived service account key, Firebase token, or database password is stored
in GitHub.

The deploy account has no direct Secret Manager access. The API's runtime
account reads its configured secrets. Deployment privileges are still sensitive:
deployed code runs with the runtime account's access.

## Configuration and failure behavior

The workflow updates only the Cloud Run image, preserving environment variables,
secret bindings, runtime identity, ingress, scaling, and public access settings.
It does not run database migrations.

The API and frontend deployments are sequential, not atomic. A failed health
check stops subsequent steps but does not automatically roll back an API update.
Cloud Run may already be updated if the later Hosting deployment fails.
