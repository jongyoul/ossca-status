import { Octokit } from 'octokit';
import type { Metadata } from 'next';
export const revalidate = 3;

export const metadata: Metadata = {
  title: 'OSSCa Status',
  description: 'Open Source Contribution Status for OSSCa members',
  openGraph: {
    title: 'OSSCa Status',
    description: 'Open Source Contribution Status for OSSCa members',
    images: [
      {
        url: '/thumbnail.png', // public 폴더에 있는 썸네일 이미지 경로
        width: 462,
        height: 313,
        alt: 'OSSCa Status Thumbnail',
      },
    ],
  },
};

const TRACKED_REPOSITORIES = ['zeppelin', 'zeppelin-site'] as const;
const DEFAULT_PR_COUNT_START_DATE = '2026-04-07';

type TrackedRepository = (typeof TRACKED_REPOSITORIES)[number];
type ItemType = 'Pull Request' | 'Issue';

interface Issue {
  repo: TrackedRepository;
  number: number;
  title: string;
  htmlUrl: string;
  type: ItemType;
  createdAt: string;
  approved: boolean;
  approvedBy: string[];
  approvedByMentor: boolean;
  mentorApprovers: string[];
  creator: string;
  merged: boolean | null;
  countsTowardPrTotal: boolean;
}

interface AppConfig {
  mentees: string[];
  mentors: string[];
  mentorLoginSet: Set<string>;
  prCountStartDate: Date;
  prCountStartDateLabel: string;
}

function parseUsernameList(value: string | undefined): string[] {
  const seen = new Set<string>();

  return (value ?? '')
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

function parsePrCountStartDate(value: string | undefined): {
  date: Date;
  label: string;
} {
  const rawValue = value?.trim() || DEFAULT_PR_COUNT_START_DATE;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(rawValue);
  const parsedDate = new Date(dateOnly ? `${rawValue}T00:00:00.000Z` : rawValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return {
      date: new Date(`${DEFAULT_PR_COUNT_START_DATE}T00:00:00.000Z`),
      label: DEFAULT_PR_COUNT_START_DATE,
    };
  }

  return {
    date: parsedDate,
    label: dateOnly ? rawValue : parsedDate.toISOString().slice(0, 10),
  };
}

function getAppConfig(): AppConfig {
  const mentees = parseUsernameList(process.env.GITHUB_USERNAMES);
  const mentors = parseUsernameList(process.env.GITHUB_MENTOR_USERNAMES);
  const { date: prCountStartDate, label: prCountStartDateLabel } =
    parsePrCountStartDate(process.env.GITHUB_PR_COUNT_START_DATE);

  return {
    mentees,
    mentors,
    mentorLoginSet: new Set(mentors.map((mentor) => mentor.toLowerCase())),
    prCountStartDate,
    prCountStartDateLabel,
  };
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

function isOnOrAfter(dateValue: string, startDate: Date): boolean {
  return new Date(dateValue).getTime() >= startDate.getTime();
}

function formatDate(dateValue: string): string {
  return new Date(dateValue).toISOString().slice(0, 10);
}

function formatBoolean(value: boolean): string {
  return value ? 'Yes' : 'No';
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

async function getIssues(
  repo: TrackedRepository,
  usernames: string[],
  mentorLoginSet: Set<string>,
  prCountStartDate: Date,
): Promise<Issue[]> {
  console.log(`Fetching issues for ${repo} from GitHub...`);
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  const issues: Issue[] = [];

  for (const username of usernames) {
    try {
      let page = 1;
      let reachedBeforeStartDate = false;

      while (!reachedBeforeStartDate) {
        const response = await octokit.request('GET /repos/{owner}/{repo}/issues', {
          owner: 'apache',
          repo,
          creator: username,
          state: 'all',
          sort: 'created',
          direction: 'desc',
          per_page: 100,
          page,
        });

        if (response.data.length === 0) break;

        for (const issue of response.data) {
          if (!isOnOrAfter(issue.created_at, prCountStartDate)) {
            reachedBeforeStartDate = true;
            break;
          }

          let approvedBy: string[] = [];
          let merged: boolean | null = null;
          const type: ItemType = issue.pull_request ? 'Pull Request' : 'Issue';

          if (issue.pull_request) {
            const [prReviews, prDetails] = await Promise.all([
              octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews', {
                owner: 'apache',
                repo,
                pull_number: issue.number,
                per_page: 100,
              }),
              octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
                owner: 'apache',
                repo,
                pull_number: issue.number,
              }),
            ]);

            approvedBy = uniqueLogins(
              prReviews.data
                .filter((review) => review.state === 'APPROVED')
                .map((review) => review.user?.login || 'unknown'),
            );
            merged = prDetails.data.merged;

          } else {
            const commentsResponse = await octokit.request('GET /repos/{owner}/{repo}/issues/{issue_number}/comments', {
              owner: 'apache',
              repo,
              issue_number: issue.number,
              per_page: 100,
            });

            approvedBy = uniqueLogins(
              commentsResponse.data
                .filter((comment) => comment.body?.toLowerCase().includes('approve'))
                .map((comment) => comment.user?.login || 'unknown'),
            );
          }

          const mentorApprovers = approvedBy.filter((login) =>
            mentorLoginSet.has(login.toLowerCase()),
          );

          issues.push({
            repo,
            number: issue.number,
            title: issue.title,
            htmlUrl: issue.html_url,
            type,
            createdAt: issue.created_at,
            approved: approvedBy.length > 0,
            approvedBy,
            approvedByMentor: mentorApprovers.length > 0,
            mentorApprovers,
            creator: issue.user?.login || 'unknown',
            merged,
            countsTowardPrTotal: type === 'Pull Request',
          });
        }

        page += 1;
      }
    } catch (error) {
      console.error(`Error fetching tracked items from ${repo}: ${getErrorMessage(error)}`);
    }
  }

  return issues;
}

export default async function Home() {
  const {
    mentees,
    mentors,
    mentorLoginSet,
    prCountStartDate,
    prCountStartDateLabel,
  } = getAppConfig();
  console.log(`Loaded ${mentees.length} mentees and ${mentors.length} mentors.`);

  const allIssues = (
    await Promise.all(
      TRACKED_REPOSITORIES.map((repo) =>
        getIssues(repo, mentees, mentorLoginSet, prCountStartDate),
      ),
    )
  ).flat();

  // Sort by repo (ascending) then by number (descending)
  allIssues.sort((a, b) => {
    if (a.repo < b.repo) return -1;
    if (a.repo > b.repo) return 1;
    return b.number - a.number; // Descending order for issue number
  });

  const countedPullRequests = allIssues.filter((issue) => issue.countsTowardPrTotal);
  const totalPullRequests = countedPullRequests.length;
  const totalIssues = allIssues.filter((issue) => issue.type === 'Issue').length;
  const mergedPullRequests = countedPullRequests.filter((issue) => issue.merged).length;
  const unmergedPullRequests = totalPullRequests - mergedPullRequests;
  const mentorApprovedPullRequests = countedPullRequests.filter(
    (issue) => issue.approvedByMentor,
  ).length;

  return (
    <main className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">OSSCa GitHub Status</h1>
      <div className="mb-4">
        <table className="min-w-full border border-gray-300">
          <thead>
            <tr>
              <th className="py-2 px-4 border-b">Category</th>
              <th className="py-2 px-4 border-b">Count</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="py-2 px-4 border-b">Tracked Mentees</td>
              <td className="py-2 px-4 border-b">{mentees.length}</td>
            </tr>
            <tr>
              <td className="py-2 px-4 border-b">Tracked Mentors</td>
              <td className="py-2 px-4 border-b">{mentors.length}</td>
            </tr>
            <tr>
              <td className="py-2 px-4 border-b">PR Count Start Date</td>
              <td className="py-2 px-4 border-b">{prCountStartDateLabel}</td>
            </tr>
            <tr>
              <td className="py-2 px-4 border-b">Listed PRs and Issues Since Start</td>
              <td className="py-2 px-4 border-b">{allIssues.length}</td>
            </tr>
            <tr>
              <td className="py-2 px-4 border-b">PRs Created Since Start</td>
              <td className="py-2 px-4 border-b">{totalPullRequests}</td>
            </tr>
            <tr>
              <td className="py-2 px-4 border-b">Issues Created Since Start</td>
              <td className="py-2 px-4 border-b">{totalIssues}</td>
            </tr>
            <tr>
              <td className="py-2 px-4 border-b">Mentor Approved PRs</td>
              <td className="py-2 px-4 border-b">{mentorApprovedPullRequests}</td>
            </tr>
            <tr>
              <td className="py-2 px-4 border-b">Merged PRs</td>
              <td className="py-2 px-4 border-b">{mergedPullRequests}</td>
            </tr>
            <tr>
              <td className="py-2 px-4 border-b">Unmerged PRs</td>
              <td className="py-2 px-4 border-b">{unmergedPullRequests}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="overflow-x-auto">
        <h2 className="text-xl font-semibold mb-2">
          PRs and Issues Created Since {prCountStartDateLabel}
        </h2>
        {allIssues.length === 0 ? (
          <p className="border border-gray-300 p-4">
            No tracked PRs or issues have been created since {prCountStartDateLabel}.
          </p>
        ) : (
          <table className="min-w-full">
            <thead>
              <tr>
                <th className="py-2 px-4 border-b">Repository</th>
                <th className="py-2 px-4 border-b">Type</th>
                <th className="py-2 px-4 border-b">Issue #</th>
                <th className="py-2 px-4 border-b">Title</th>
                <th className="py-2 px-4 border-b">Creator</th>
                <th className="py-2 px-4 border-b">Created</th>
                <th className="py-2 px-4 border-b">Approved</th>
                <th className="py-2 px-4 border-b">Mentor Approved</th>
                <th className="py-2 px-4 border-b">Merged</th>
                <th className="py-2 px-4 border-b">Approved By</th>
                <th className="py-2 px-4 border-b">Link</th>
              </tr>
            </thead>
            <tbody>
              {allIssues.map((issue) => (
                <tr key={`${issue.repo}-${issue.number}`}>
                  <td className="py-2 px-4 border-b">{issue.repo}</td>
                  <td className="py-2 px-4 border-b">{issue.type}</td>
                  <td className="py-2 px-4 border-b">{issue.number}</td>
                  <td className="py-2 px-4 border-b">{issue.title}</td>
                  <td className="py-2 px-4 border-b">{issue.creator}</td>
                  <td className="py-2 px-4 border-b">{formatDate(issue.createdAt)}</td>
                  <td className="py-2 px-4 border-b">{formatBoolean(issue.approved)}</td>
                  <td className="py-2 px-4 border-b">
                    {issue.approvedByMentor
                      ? `Yes (${issue.mentorApprovers.join(', ')})`
                      : 'No'}
                  </td>
                  <td className="py-2 px-4 border-b">
                    {issue.merged === null ? 'N/A' : formatBoolean(issue.merged)}
                  </td>
                  <td className="py-2 px-4 border-b">
                    {issue.approvedBy.length > 0 ? issue.approvedBy.join(', ') : 'N/A'}
                  </td>
                  <td className="py-2 px-4 border-b">
                    <a href={issue.htmlUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                      View on GitHub
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
