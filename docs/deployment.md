# Automatic deployment

`.github/workflows/deploy.yml` tests both apps and builds them on pull requests
and pushes to `main`. After successful checks on `main`, it:

1. Builds and pushes the API image with the single mutable `latest` tag.
2. Updates the existing Cloud Run service using that image's immutable digest.
3. Checks the API and database health.
4. Publishes the verified frontend to Firebase Hosting.
5. Checks the `/api/health` proxy through Hosting.

You can also start it from GitHub's **Actions → Test and deploy → Run workflow**
on `main`. Deploys are serialized; running deploys are not cancelled.

Only `latest` is pushed. Previous untagged image digests and Cloud Run revisions
can still remain: this workflow does not delete them or configure cleanup.

## One-time Google Cloud setup

Run these commands yourself while authenticated as a project administrator.
They create a dedicated deploy identity and grant permissions; they do not
deploy or change the running app. No JSON key, Firebase token, database password,
or GitHub repository secret is needed.

### 1. Enable authentication APIs

```bash
gcloud services enable \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  sts.googleapis.com \
  firebase.googleapis.com \
  firebasehosting.googleapis.com \
  --project=simple-time-tracker-514822
```

Cloud Run and Artifact Registry must already be enabled. This workflow expects
the existing `time-tracker-api` service and `simple-time-tracker` Docker repository
in `southamerica-east1`, with the Firebase Hosting site already initialized.

### 2. Create the deploy service account

```bash
gcloud iam service-accounts create github-deploy \
  --display-name="GitHub Actions deploy" \
  --project=simple-time-tracker-514822
```

Grant image upload access only to the app repository:

```bash
gcloud artifacts repositories add-iam-policy-binding simple-time-tracker \
  --location=southamerica-east1 \
  --member="serviceAccount:github-deploy@simple-time-tracker-514822.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer" \
  --project=simple-time-tracker-514822
```

Grant Cloud Run deployment and Hosting publication permissions:

```bash
gcloud projects add-iam-policy-binding simple-time-tracker-514822 \
  --member="serviceAccount:github-deploy@simple-time-tracker-514822.iam.gserviceaccount.com" \
  --role="roles/run.developer"
```

```bash
gcloud projects add-iam-policy-binding simple-time-tracker-514822 \
  --member="serviceAccount:github-deploy@simple-time-tracker-514822.iam.gserviceaccount.com" \
  --role="roles/firebasehosting.admin"
```

```bash
gcloud projects add-iam-policy-binding simple-time-tracker-514822 \
  --member="serviceAccount:github-deploy@simple-time-tracker-514822.iam.gserviceaccount.com" \
  --role="roles/serviceusage.serviceUsageConsumer"
```

Allow deployments to use the existing API runtime identity:

```bash
gcloud iam service-accounts add-iam-policy-binding \
  time-tracker-api@simple-time-tracker-514822.iam.gserviceaccount.com \
  --member="serviceAccount:github-deploy@simple-time-tracker-514822.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser" \
  --project=simple-time-tracker-514822
```

The deploy identity has no direct Secret Manager access. Cloud Run continues
using the runtime account and secret bindings configured during initial setup.
As with any production deploy identity, someone able to deploy code could make
the runtime code access its secrets: protect `main` and review workflow changes.

### 3. Trust only this GitHub repository's main branch

Create a Workload Identity pool:

```bash
gcloud iam workload-identity-pools create github-actions \
  --location=global \
  --display-name="GitHub Actions" \
  --project=simple-time-tracker-514822
```

Create the GitHub OIDC provider. The condition uses immutable repository and
owner IDs for `pablovrl/simple-time-tracker` and only allows pushes or manual
workflow runs on `main`; pull requests cannot authenticate.

```bash
gcloud iam workload-identity-pools providers create-oidc github \
  --workload-identity-pool=github-actions \
  --location=global \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository_id=assertion.repository_id,attribute.repository_owner_id=assertion.repository_owner_id" \
  --attribute-condition="assertion.repository_id == '1459271420' && assertion.repository_owner_id == '62177255' && assertion.ref == 'refs/heads/main' && (assertion.event_name == 'push' || assertion.event_name == 'workflow_dispatch')" \
  --project=simple-time-tracker-514822
```

Allow that repository to impersonate the deploy account:

```bash
gcloud iam service-accounts add-iam-policy-binding \
  github-deploy@simple-time-tracker-514822.iam.gserviceaccount.com \
  --member="principalSet://iam.googleapis.com/projects/101789988033/locations/global/workloadIdentityPools/github-actions/attribute.repository_id/1459271420" \
  --role="roles/iam.workloadIdentityUser" \
  --project=simple-time-tracker-514822
```

IAM changes may take a few minutes to propagate. If a resource already exists,
inspect/reuse it rather than creating another identity or deleting it.

## Production configuration and migrations

The workflow only updates the Cloud Run image. It preserves environment
variables, secrets, runtime account, ingress, scaling, and public access settings.
In particular, `FIREBASE_HOSTING=true` and the HTTPS frontend/OAuth URLs must
already be configured.

**Database migrations are not automatic.** Apply reviewed, backward-compatible
migrations against the correct database before deploying code that needs them.
Never put `DATABASE_URL` in the workflow, build arguments, or frontend.

The API deploy and Hosting deploy are not atomic. A failed health check stops
the workflow but does not automatically roll back the API; an API update can
succeed even if Hosting subsequently fails. Keep API changes compatible with the
previous frontend and investigate failed runs before retrying.
