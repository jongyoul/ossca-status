import { unstable_cache } from 'next/cache';
import { Octokit } from 'octokit';

const TRACKED_REPOSITORIES = ['zeppelin', 'zeppelin-site'] as const;
const GITHUB_DATA_REVALIDATE_SECONDS = 30;
const inFlightStatusRequests = new Map<string, Promise<StatusItem[]>>();

type TrackedRepository = (typeof TRACKED_REPOSITORIES)[number];
export type CreatorRole = 'Mentee' | 'Mentor' | 'Mentee, Mentor' | 'Other';

export interface StatusItem {
  repo: TrackedRepository;
  number: number;
  title: string;
  htmlUrl: string;
  createdAt: string;
  creator: string;
  creatorRole: CreatorRole;
  merged: boolean;
}

export interface StatusConfig {
  mentees: string[];
  mentors: string[];
  trackedAuthors: string[];
  prCountStartDateLabel: string;
}

export interface PublicStatusConfig {
  menteeCount: number;
  mentorCount: number;
  trackedAuthorCount: number;
  prCountStartDateLabel: string;
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function parseUsernameList(value: string): string[] {
  const seen = new Set<string>();

  return value
    .split(',')
    .map((username) => username.trim())
    .filter((username) => {
      if (!username) return false;

      const key = username.toLowerCase();
      if (seen.has(key)) return false;

      seen.add(key);
      return true;
    });
}

function uniqueLogins(logins: string[]): string[] {
  const seen = new Set<string>();

  return logins.filter((login) => {
    const key = login.toLowerCase();
    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

function parsePrCountStartDate(value: string | undefined): {
  date: Date;
  label: string;
} {
  const rawValue = value?.trim();

  if (!rawValue) {
    throw new Error('Missing required environment variable: GITHUB_PR_COUNT_START_DATE');
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(rawValue);

  if (!match) {
    throw new Error('GITHUB_PR_COUNT_START_DATE must be a valid date in YYYY-MM-DD format.');
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsedDate = new Date(Date.UTC(year, month - 1, day));

  if (
    parsedDate.getUTCFullYear() !== year ||
    parsedDate.getUTCMonth() !== month - 1 ||
    parsedDate.getUTCDate() !== day
  ) {
    throw new Error('GITHUB_PR_COUNT_START_DATE must be a valid date in YYYY-MM-DD format.');
  }

  return {
    date: parsedDate,
    label: rawValue,
  };
}

function isOnOrAfter(dateValue: string, startDate: Date): boolean {
  return new Date(dateValue).getTime() >= startDate.getTime();
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

function getCreatorRole(
  login: string,
  menteeLoginSet: Set<string>,
  mentorLoginSet: Set<string>,
): CreatorRole {
  const key = login.toLowerCase();
  const isMentee = menteeLoginSet.has(key);
  const isMentor = mentorLoginSet.has(key);

  if (isMentee && isMentor) return 'Mentee, Mentor';
  if (isMentee) return 'Mentee';
  if (isMentor) return 'Mentor';
  return 'Other';
}

function isTrackedPullRequestState(state: string, mergedAt: string | null): boolean {
  return state === 'open' || Boolean(mergedAt);
}

async function getRepositoryPullRequests(
  repo: TrackedRepository,
  trackedAuthorSet: Set<string>,
  menteeLoginSet: Set<string>,
  mentorLoginSet: Set<string>,
  prCountStartDate: Date,
  githubToken: string,
): Promise<StatusItem[]> {
  console.log(`Fetching pull requests for ${repo} from GitHub...`);
  const octokit = new Octokit({ auth: githubToken });
  const pullRequests: StatusItem[] = [];
  let page = 1;
  let reachedBeforeStartDate = false;

  try {
    while (!reachedBeforeStartDate) {
      const response = await octokit.request('GET /repos/{owner}/{repo}/pulls', {
        owner: 'apache',
        repo,
        state: 'all',
        sort: 'created',
        direction: 'desc',
        per_page: 100,
        page,
      });

      if (response.data.length === 0) break;

      for (const pullRequest of response.data) {
        if (!isOnOrAfter(pullRequest.created_at, prCountStartDate)) {
          reachedBeforeStartDate = true;
          break;
        }

        if (!isTrackedPullRequestState(pullRequest.state, pullRequest.merged_at)) {
          continue;
        }

        const creator = pullRequest.user?.login || 'unknown';
        if (!trackedAuthorSet.has(creator.toLowerCase())) continue;

        pullRequests.push({
          repo,
          number: pullRequest.number,
          title: pullRequest.title,
          htmlUrl: pullRequest.html_url,
          createdAt: pullRequest.created_at,
          creator,
          creatorRole: getCreatorRole(creator, menteeLoginSet, mentorLoginSet),
          merged: Boolean(pullRequest.merged_at),
        });
      }

      page += 1;
    }
  } catch (error) {
    console.error(`Error fetching tracked pull requests from ${repo}: ${getErrorMessage(error)}`);
  }

  return pullRequests;
}

const getCachedStatusItems = unstable_cache(
  async (
    trackedAuthors: string[],
    mentees: string[],
    mentors: string[],
    prCountStartDateLabel: string,
  ): Promise<StatusItem[]> => {
    const prCountStartDate = parsePrCountStartDate(prCountStartDateLabel).date;
    const trackedAuthorSet = new Set(
      trackedAuthors.map((author) => author.toLowerCase()),
    );
    const menteeLoginSet = new Set(mentees.map((mentee) => mentee.toLowerCase()));
    const mentorLoginSet = new Set(mentors.map((mentor) => mentor.toLowerCase()));
    const githubToken = getRequiredEnv('GITHUB_TOKEN');

    return (
      await Promise.all(
        TRACKED_REPOSITORIES.map((repo) =>
          getRepositoryPullRequests(
            repo,
            trackedAuthorSet,
            menteeLoginSet,
            mentorLoginSet,
            prCountStartDate,
            githubToken,
          ),
        ),
      )
    ).flat();
  },
  ['tracked-github-pull-requests'],
  { revalidate: GITHUB_DATA_REVALIDATE_SECONDS },
);

export function getStatusConfig(): StatusConfig {
  const mentees = parseUsernameList(getRequiredEnv('GITHUB_USERNAMES'));
  const mentors = parseUsernameList(getRequiredEnv('GITHUB_MENTOR_USERNAMES'));
  const trackedAuthors = uniqueLogins([...mentees, ...mentors]);
  const { label: prCountStartDateLabel } = parsePrCountStartDate(
    process.env.GITHUB_PR_COUNT_START_DATE,
  );

  getRequiredEnv('GITHUB_TOKEN');

  return {
    mentees,
    mentors,
    trackedAuthors,
    prCountStartDateLabel,
  };
}

export function getPublicStatusConfig(config: StatusConfig): PublicStatusConfig {
  return {
    menteeCount: config.mentees.length,
    mentorCount: config.mentors.length,
    trackedAuthorCount: config.trackedAuthors.length,
    prCountStartDateLabel: config.prCountStartDateLabel,
  };
}

export async function getStatusItems(config: StatusConfig): Promise<StatusItem[]> {
  const cacheKey = JSON.stringify({
    trackedAuthors: config.trackedAuthors,
    mentees: config.mentees,
    mentors: config.mentors,
    prCountStartDateLabel: config.prCountStartDateLabel,
  });
  const existingRequest = inFlightStatusRequests.get(cacheKey);

  if (existingRequest) {
    return existingRequest;
  }

  const nextRequest = getCachedStatusItems(
    config.trackedAuthors,
    config.mentees,
    config.mentors,
    config.prCountStartDateLabel,
  )
    .then((items) =>
      items.toSorted((a, b) => {
        if (a.repo < b.repo) return -1;
        if (a.repo > b.repo) return 1;
        return b.number - a.number;
      }),
    )
    .finally(() => {
      inFlightStatusRequests.delete(cacheKey);
    });

  inFlightStatusRequests.set(cacheKey, nextRequest);
  return nextRequest;
}
