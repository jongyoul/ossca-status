# OSSCA Status Page Specification

`SPEC.md` is the source of truth for what the status page should show.
Operational workflow instructions belong in `AGENTS.md`.

## Purpose

The page shows OSSCA pull request contribution status for Apache
Zeppelin-related repositories during the active tracking window.

The page is not a full GitHub history browser. It should show only the items
that are relevant to the current OSSCA tracking period.

## Tracked Repositories

- `apache/zeppelin`
- `apache/zeppelin-site`

## Environment Variables

- `GITHUB_USERNAMES`: comma-separated mentee GitHub usernames
- `GITHUB_MENTOR_USERNAMES`: comma-separated mentor GitHub usernames
- `GITHUB_PR_COUNT_START_DATE`: tracking start date in `YYYY-MM-DD` format
- `GITHUB_TOKEN`: GitHub token used by the server to read public repository data

All environment variables are required at runtime. There is no default start
date.

If `GITHUB_PR_COUNT_START_DATE` is missing or invalid, the rendered page should
raise a clear missing or invalid environment variable error. Build-time should
not require these environment variables.

Actual username lists and token values must not be committed to the repository.

## Tracked Authors

Tracked authors are the case-insensitive union of:

- mentees from `GITHUB_USERNAMES`
- mentors from `GITHUB_MENTOR_USERNAMES`

Both mentee-authored and mentor-authored items are in scope.

## Tracking Window

Include only GitHub pull requests created on or after
`GITHUB_PR_COUNT_START_DATE`.

There is no end date.

Items created before the start date must not appear in the list and must not
contribute to summary counts.

## Data Freshness

The page should not fetch GitHub data at build time. GitHub data should be read
through the server-side `/api/status` endpoint and may be cached for 30 seconds.

When the page is open in a browser, the GitHub data section should poll
`/api/status` every 30 seconds so changed GitHub data can appear without a
manual reload.

The summary should render before GitHub data is available. Configuration rows
should show their values immediately, and GitHub-derived summary rows should
show a loading value until `/api/status` returns. GitHub data loading, refresh,
and errors should be scoped to the data section rather than blocking the whole
page shell.

GitHub fetching should scan pull requests in each tracked repository by
creation date and filter tracked authors server-side. Do not scan GitHub once
per tracked author; that makes the first data load unnecessarily slow.
Fetching must follow paginated GitHub results until it reaches pull requests
created before the tracking window or there are no more results. Do not assume
the first 100 API results cover the full tracking window.

When multiple requests arrive while a server instance is already fetching fresh
GitHub data, those requests should share the in-flight fetch where possible.

## Row Data

For each tracked pull request, show:

- Repository
- PR number
- Title
- Creator
- Creator role: `Mentee`, `Mentor`, or `Mentee, Mentor`
- Created date
- Merged status
- GitHub link

Do not show a type column. The table is pull-request-only.
The table should allow sorting visible rows by merged status.

## Summary Counts

The summary should count the same tracking window shown in the row list:

- Tracked mentees
- Tracked mentors
- Tracked authors
- PR count start date
- PRs created since start
- Mentee-authored PRs
- Mentor-authored PRs
- Merged PRs
- Unmerged PRs

These values should be shown in one summary table, not split into separate
configuration and GitHub-count summary tables.

## Pull Request Success Rule

A pull request is successful when it is merged.

Do not compute or display approval status. The page does not need approver
identity, mentor approval, review state, or issue-comment approval detection.

## Acceptance Checks

The rendered page should satisfy these checks:

- tracked authors include both mentees and mentors
- no item before `GITHUB_PR_COUNT_START_DATE` is shown
- PR counts match the visible PR rows
- merged and unmerged PR counts match row-level merged status
- type or issue columns are not present
- approval or approver columns are not present
