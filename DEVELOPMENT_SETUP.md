# KavShare Development Setup Guide

Welcome to the KavShare development team! This guide will walk you through setting up your local development environment from scratch.

---

## 1. Prerequisites

Before starting, ensure you have the following software installed on your machine:

1.  **Node.js (v18.x or v20.x+)**: Required for Next.js 16. [Download Node.js](https://nodejs.org/).
2.  **npm (v9.x or v10.x+)**: Comes bundled with Node.js.
3.  **Git**: For version control. [Download Git](https://git-scm.com/).
4.  **Docker Desktop**: Required to run the local Supabase database and storage containers. [Download Docker](https://www.docker.com/products/docker-desktop/).
5.  **Supabase CLI**: For local database development, migrations, and schema resets.
    - **macOS (via Homebrew)**: `brew install supabase/tap/supabase`
    - **Windows (via Scoop)**: `scoop bucket add supabase https://github.com/supabase/scoop-bucket.git && scoop install supabase`
    - **Linux (Direct npm fallback)**: `npm install -g supabase` (Or download direct binaries from the [Supabase GitHub releases page](https://github.com/supabase/cli/releases)).

---

## 2. Setting Up Environment Variables

All environment settings are loaded from a `.env.local` file (which is ignored by Git to keep secrets safe).

1.  Copy the template file `.env.example` in the root folder and rename it to `.env.local`:
    ```bash
    cp .env.example .env.local
    ```
2.  Open `.env.local` and populate the placeholders with your credentials:
    - **Supabase Settings**: Retrieve URL, Anon Key, and Service Role Key from either your local docker start logs or your Supabase Cloud project dashboard.
    - **Clerk Auth Keys**: Generate keys in your [Clerk Dashboard](https://clerk.com/).
    - **Stripe Keys**: Get test credentials from the Developer section of your [Stripe Dashboard](https://stripe.com/).
    - **Generative AI SDK Keys**:
      - Get a Gemini key from [Google AI Studio](https://aistudio.google.com/).
      - Get a Groq key from [Groq Console](https://console.groq.com/).
    - **Resend & Tally**: Sign up and add testing keys from [Resend](https://resend.com/) and [Tally.so](https://tally.so/).

---

## 3. Database Connection & Migrations

KavShare uses Supabase CLI to manage the database locally using Docker containerization.

### A. Start Local Supabase Containers

Ensure Docker Desktop is open and running, then start the database inside the project directory:

```bash
supabase start
```

This command will pull the required images, start the containers, and output your local credentials, database connection strings, and studio web interface URL (typically `http://localhost:54323`).

### B. Run Migrations & DB Reset

Apply the initial schema (tables, foreign keys, RLS security policies) using:

```bash
supabase db reset
```

This automatically recreates your database and applies all migrations from `/supabase/migrations`.

### C. Seed Test Data

Run the seeding template to populate mock tables for profiles and files:

```bash
npx ts-node scripts/seed.ts
```

---

## 4. Running the Development Server

1.  Install the required package dependencies:
    ```bash
    npm install
    ```
2.  Launch the Next.js development server:
    ```bash
    npm run dev
    ```
3.  Open [http://localhost:3000](http://localhost:3000) in your web browser. Next.js 16 leverages Turbopack by default, enabling fast compile times.

---

## 5. Running Tests

KavShare uses **Playwright** for End-to-End (E2E) UI testing.

1.  Before running tests for the first time, install the required browser binaries:
    ```bash
    npx playwright install
    ```
2.  To execute tests in headless mode:
    ```bash
    npx playwright test
    ```
3.  To run tests in interactive UI mode:
    ```bash
    npx playwright test --ui
    ```

---

## 6. Common Troubleshooting

### Docker connection issues

- **Error**: `docker daemon is not running`
- **Solution**: Open Docker Desktop, wait for the engine state indicator in the bottom-left corner to turn green, and retry `supabase start`.

### Git commits block due to format errors

- **Problem**: Git rejects your commits with lint warnings.
- **Reason**: Husky pre-commit hooks are active and enforce strict formatting rules.
- **Solution**: Run `npx prettier --write .` and `npm run lint` manually to fix formatting and syntax issues, then commit again.

### Workspace lockfile warning during builds

- **Warning**: `We detected multiple lockfiles and selected the directory of C:\Users\admin\package-lock.json as the root directory...`
- **Solution**: Next.js detects lockfiles higher up in your folder structure. This is normal in multi-project development environments and does not break compilation. You can silence this warning by configuring `turbopack.root` in `next.config.ts`.
