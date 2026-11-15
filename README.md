# Simple Time Tracker

A time-tracking application with an Angular frontend and a NestJS API, managed with npm workspaces.

## Requirements

- A Node.js version compatible with both applications.
- npm `12.2.2`.

## Project structure

```text
apps/
  api/   # NestJS API
  web/   # Angular frontend
```

See the [API README](apps/api/README.md) and [web README](apps/web/README.md) for application-specific details.

## Installation

Run from the repository root:

```bash
npm ci
```

## Development

Start each application in a separate terminal, from the repository root:

```bash
npm run dev:api
```

```bash
npm run dev:web
```

## Build and test

Build both applications:

```bash
npm run build
```

Run all tests without watch mode:

```bash
npm test
```

Run tests for a single application:

```bash
npm run test:api
npm run test:web
```

## Database

The API uses PostgreSQL with Drizzle ORM. The schema is defined in
[`apps/api/src/database/schema.ts`](apps/api/src/database/schema.ts).
See the [data model diagram](docs/data-model.md) for entity relationships.

Prepare the local environment file from the repository root:

```bash
cp apps/api/.env.example apps/api/.env
```

Update `DATABASE_URL` in `apps/api/.env` with your PostgreSQL connection details.
The example contains placeholder credentials, not a provisioned database.

Generate SQL migrations from the schema (no database connection required):

```bash
npm run db:generate -w api
```

Apply migrations to a running PostgreSQL instance:

```bash
npm run db:migrate -w api
```

Applying migrations requires a valid `DATABASE_URL`. Database access is not yet
wired into the NestJS application, so starting the API does not require PostgreSQL.

## Managing dependencies

Install a dependency for a specific workspace from the repository root:

```bash
npm install <package> -w api
npm install <package> -w web
```

Add `-D` for development dependencies.

Keep a single `package-lock.json` at the repository root. npm may create
`node_modules` directories inside individual workspaces when dependencies cannot
be shared, such as when applications require different versions. This is expected.
