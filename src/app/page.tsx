import { Octokit } from 'octokit';
import type { Metadata } from 'next';

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

export const revalidate = 5; // Revalidate every 5 seconds

interface Issue {
  repo: string;
  number: number;
  title: string;
  html_url: string;
  approved: boolean;
  approvedBy: string | null;
  creator: string;
  merged: boolean;
}

interface CacheEntry {
  data: Issue[];
  timestamp: number;
}

const issueCache: { [key: string]: CacheEntry } = {};
const CACHE_DURATION = 5 * 1000; // 5 seconds

async function getIssues(repo: string, usernames: string[]): Promise<Issue[]> {
  const cacheKey = `${repo}-${usernames.join(',')}`;
  const cachedData = issueCache[cacheKey];

  if (cachedData && (Date.now() - cachedData.timestamp < CACHE_DURATION)) {
    console.log(`Cache hit for ${cacheKey}`);
    return cachedData.data;
  }

  console.log(`Cache miss for ${cacheKey}. Fetching from GitHub...`);
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  const issues: Issue[] = [];

  for (const username of usernames) {
    try {
      const response = await octokit.request('GET /repos/{owner}/{repo}/issues', {
        owner: 'apache',
        repo,
        creator: username,
        state: 'all',
      });

      for (const issue of response.data) {
        let approved = false;
        let approvedBy = null;
        let merged = false;

        if (issue.pull_request) {
          const prReviews = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews', {
            owner: 'apache',
            repo,
            pull_number: issue.number,
          });

          for (const review of prReviews.data) {
            if (review.state === 'APPROVED') {
              approved = true;
              approvedBy = review.user?.login || 'unknown';
              break;
            }
          }

          const prDetails = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
            owner: 'apache',
            repo,
            pull_number: issue.number,
          });
          merged = prDetails.data.merged;

        } else {
          const commentsResponse = await octokit.request('GET /repos/{owner}/{repo}/issues/{issue_number}/comments', {
            owner: 'apache',
            repo,
            issue_number: issue.number,
          });

          for (const comment of commentsResponse.data) {
            if (comment.body?.toLowerCase().includes('approve')) {
              approved = true;
              approvedBy = comment.user?.login || 'unknown';
              break;
            }
          }
        }
        
        issues.push({
          repo,
          number: issue.number,
          title: issue.title,
          html_url: issue.html_url,
          approved,
          approvedBy,
          creator: issue.user?.login || 'unknown',
          merged,
        });
      }
    } catch (error) {
      console.error(`Error fetching issues for ${username} from ${repo}:`, error);
    }
  }

  issueCache[cacheKey] = { data: issues, timestamp: Date.now() };
  return issues;
}

export default async function Home() {
  const usernames = process.env.GITHUB_USERNAMES?.split(',') || [];
  console.log('Usernames:', usernames);

  const zeppelinIssues = await getIssues('zeppelin', usernames);
  const zeppelinSiteIssues = await getIssues('zeppelin-site', usernames);
  const allIssues = [...zeppelinIssues, ...zeppelinSiteIssues];

  // Sort by repo (ascending) then by number (descending)
  allIssues.sort((a, b) => {
    if (a.repo < b.repo) return -1;
    if (a.repo > b.repo) return 1;
    return b.number - a.number; // Descending order for issue number
  });

  const totalIssues = allIssues.length;
  const mergedIssues = allIssues.filter(issue => issue.merged).length;
  const unmergedIssues = totalIssues - mergedIssues;

  return (
    <main className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">GitHub Issues</h1>
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
              <td className="py-2 px-4 border-b">Total Issues</td>
              <td className="py-2 px-4 border-b">{totalIssues}</td>
            </tr>
            <tr>
              <td className="py-2 px-4 border-b">Merged Issues</td>
              <td className="py-2 px-4 border-b">{mergedIssues}</td>
            </tr>
            <tr>
              <td className="py-2 px-4 border-b">Unmerged Issues</td>
              <td className="py-2 px-4 border-b">{unmergedIssues}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr>
              <th className="py-2 px-4 border-b">Repository</th>
              <th className="py-2 px-4 border-b">Issue #</th>
              <th className="py-2 px-4 border-b">Title</th>
              <th className="py-2 px-4 border-b">Creator</th>
              <th className="py-2 px-4 border-b">Approved</th>
              <th className="py-2 px-4 border-b">Merged</th>
              <th className="py-2 px-4 border-b">Approved By</th>
              <th className="py-2 px-4 border-b">Link</th>
            </tr>
          </thead>
          <tbody>
            {allIssues.map((issue) => (
              <tr key={`${issue.repo}-${issue.number}`}>
                <td className="py-2 px-4 border-b">{issue.repo}</td>
                <td className="py-2 px-4 border-b">{issue.number}</td>
                <td className="py-2 px-4 border-b">{issue.title}</td>
                <td className="py-2 px-4 border-b">{issue.creator}</td>
                <td className="py-2 px-4 border-b">{issue.approved ? '✅' : '❌'}</td>
                <td className="py-2 px-4 border-b">{issue.merged ? '✅' : '❌'}</td>
                <td className="py-2 px-4 border-b">{issue.approvedBy || 'N/A'}</td>
                <td className="py-2 px-4 border-b">
                  <a href={issue.html_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                    View on GitHub
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}