# Agent Instructions

`AGENTS.md` is the operational guide for AI agents working in this repository.
The status page product contract lives in `SPEC.md`.

## Before Editing

- Read `SPEC.md` before changing page behavior.
- Keep `README.md` short. It should only point agents to `AGENTS.md` and
  `SPEC.md`.
- Do not commit actual username lists, GitHub tokens, Vercel tokens, or other
  secret values.
- `.env.local` is for local testing only and must remain untracked.

## Vercel Project

- GitHub repository: `git@github.com:jongyoul/ossca-status.git`
- Vercel project: `jongyoul-dev/ossca-status`
- The Vercel project is already linked locally.
- Vercel CLI is installed and authenticated in this workspace.

Useful checks:

```bash
vercel env ls
vercel project ls
```

## Environment Variables

Required variables are defined in `SPEC.md`.

Vercel scopes are managed separately. Add or update variables in each target
environment explicitly:

```bash
printf '<value>\n' | vercel env add GITHUB_PR_COUNT_START_DATE production
printf '<value>\n' | vercel env add GITHUB_PR_COUNT_START_DATE preview
printf '<value>\n' | vercel env add GITHUB_PR_COUNT_START_DATE development
```

Use the same pattern for other variables. Do not write real values into tracked
files or documentation.

If a variable already exists and needs a new value, remove it from the target
environment and add it again:

```bash
vercel env rm GITHUB_PR_COUNT_START_DATE production
printf '<value>\n' | vercel env add GITHUB_PR_COUNT_START_DATE production
```

Repeat for `preview` and `development` when needed. Check the final state with
`vercel env ls`; this should show names and scopes, not secret values.

For local testing, pull Development variables into `.env.local`:

```bash
vercel env pull .env.local --yes --environment=development
```

This overwrites `.env.local`. If the file contains local-only test values, check
the file after pulling and keep only the variables needed for local testing.

After changing Vercel environment variables, production needs a new deployment
before those values affect the production app.

## Deployment

Because the app is not live yet, the current workflow is direct and simple:

- commit on `main`
- push `main` to GitHub
- redeploy production when production needs the new code or environment values

Use Vercel CLI only when the user asks for an explicit deployment:

```bash
vercel --prod
```

## Development Server

Start the local development server with:

```bash
npm run dev -- --port 3001
```

Use another port if `3001` is already occupied. When verifying in the Codex
in-app browser, open the active localhost URL.

Do not run `next build` while the dev server is serving the page if browser
verification is in progress. Stop and restart the dev server around production
builds to avoid stale `_next/static` assets.

## Verification

For behavior changes, run:

```bash
npm run build
```

Then verify the rendered page in the browser against the acceptance checks in
`SPEC.md`.

When using direct GitHub API checks, report aggregate counts unless the user
asks for specific rows.

## Git Workflow

The user currently prefers direct updates on `main` because the app is not live.

For corrective follow-ups to the same change:

```bash
git commit --amend --no-edit
git push --force-with-lease origin main
```

Do not force-push unrelated changes. Check `git status --short --branch` before
staging or pushing.
