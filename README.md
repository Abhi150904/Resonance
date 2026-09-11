# Resonance

Resonance is an AI voice studio for creators, teams, and builders who need realistic speech generation without stitching together a pile of disconnected tools.

Write a prompt, choose a voice, tune the delivery, and generate polished speech. Build a private voice library for your workspace. Clone voices from uploaded or recorded audio. Track usage, manage billing, and keep every generation available for playback.

This is not just a text-to-speech demo. Resonance is built as a full SaaS product with authentication, organizations, billing, storage, API boundaries, and production-style data flows.

## The Pitch

Most AI voice tools stop at one generation box. Resonance goes further:

- Generate speech from text with adjustable voice controls.
- Save every generation with its prompt, voice, settings, and audio.
- Browse a curated system voice library by use case and language.
- Create custom voices from uploaded or recorded samples.
- Keep voices and generations private to each team workspace.
- Gate expensive AI workflows behind subscription access.
- Give subscribed users usage visibility and billing management.

Resonance is designed for the kind of workflows real users care about: trying multiple voices, reusing assets, managing custom voices, and coming back to previous outputs.

## Product Features

### Text-to-Speech Studio

The generation workspace gives users a focused interface for converting text into audio. Users can select a voice, adjust generation settings, submit text, and play back the resulting audio.

Supported generation controls include:

- Temperature
- Top-p
- Top-k
- Repetition penalty

### Voice Library

Resonance includes a browsable voice library with both system voices and organization-owned custom voices. Each voice can include:

- Name
- Description
- Category
- Language
- Voice type

This makes the product feel closer to a real creative tool than a single-purpose API wrapper.

### Custom Voice Cloning

Users can create custom voices directly from the dashboard. The voice creation flow supports:

- Audio upload
- In-browser recording
- File size validation
- Audio metadata parsing
- Minimum duration checks
- Private storage after validation

Custom voices are scoped to the active organization, so one team cannot access another team's assets.

### Billing and Upgrade Flow

Resonance uses Polar to power the paid-product flow:

- Checkout session creation
- Subscription checks before paid actions
- Customer portal sessions
- Usage event ingestion
- Upgrade prompts for unsubscribed organizations

Text-to-speech generation and custom voice creation are protected behind subscription checks, which keeps expensive backend workflows tied to billing state.

### Private Audio Storage

Generated speech and voice samples are stored in Azure Blob Storage. The app serves audio through authenticated API routes and signed blob URLs, keeping private media assets out of public storage.

## Why This Project Matters

Resonance demonstrates how to turn an AI capability into a complete product. The hard part is not just calling a model. The hard part is everything around it:

- Who is allowed to generate?
- Which workspace owns the data?
- Where does the audio live?
- What happens if storage fails?
- How does billing control usage?
- How does the UI guide the user through all of it?

This project answers those questions with a cohesive full-stack implementation.

## Technical Overview

```txt
User
  -> Next.js dashboard
  -> tRPC client
  -> tRPC routers and route handlers
  -> PostgreSQL, Polar, Azure Blob Storage, Chatterbox TTS API
```

Core backend areas:

- `voices` router for listing and deleting voices.
- `generation` router for creating and reading text-to-speech generations.
- `billing` router for checkout, portal, and subscription status.
- `/api/voices/create` for custom voice creation from audio files.
- `/api/audio/[generationId]` for authenticated generated-audio playback.
- `/api/voices/[voiceId]` for authenticated voice preview playback.

## Architecture

```txt
Next.js App Router
  -> Dashboard pages
  -> Feature-based React components
  -> tRPC React client

tRPC API
  -> Organization-protected procedures
  -> Zod input validation
  -> Prisma database access
  -> Polar billing checks
  -> Chatterbox speech generation

Storage Layer
  -> Azure Blob upload
  -> Signed audio URLs
  -> Authenticated playback routes

Database
  -> Voice records
  -> Generation records
  -> Organization-scoped ownership
```

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- tRPC
- TanStack Query
- Prisma
- PostgreSQL
- Clerk
- Polar
- Azure Blob Storage
- Tailwind CSS
- shadcn-style UI components
- OpenAPI-generated Chatterbox API types

## Data Model

Resonance uses two primary domain models:

- `Voice`: system or custom voices, including category, language, owner organization, and storage key.
- `Generation`: generated speech records, including prompt text, selected voice, generation settings, and stored audio key.

System voices are globally available. Custom voices and generations are scoped to a Clerk organization.

## Security and Access

- Users must be authenticated through Clerk.
- Most product actions require an active organization.
- Organization-scoped records are filtered by `orgId`.
- Audio playback routes verify ownership before serving media.
- Subscription-gated workflows check Polar customer state before running expensive actions.

## Reliability Details

The app includes cleanup paths for workflows that span both the database and blob storage. For example, if custom voice upload fails after creating a database record, the created record is removed so the user does not end up with a broken voice entry.

Usage events are sent to Polar after successful paid actions. Metering failures are handled without breaking the user-facing workflow.

## Local Development

Install dependencies:

```bash
npm install
```

Create a `.env` file:

```bash
DATABASE_URL=
APP_URL=

POLAR_ACCESS_TOKEN=
POLAR_SERVER=
POLAR_PRODUCT_ID=

AZURE_STORAGE_ACCOUNT_NAME=
AZURE_STORAGE_ACCOUNT_KEY=
AZURE_STORAGE_CONTAINER_NAME=

CHATTERBOX_API_URL=
CHATTERBOX_API_KEY=

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
```

Generate the Prisma client:

```bash
npx prisma generate
```

Run migrations:

```bash
npx prisma migrate dev
```

Start the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run sync-api
```

`npm run sync-api` fetches the Chatterbox OpenAPI schema from `CHATTERBOX_API_URL` and regenerates `src/types/chatterbox-api.d.ts`.

