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

interface Issue {
  repo: string;
  number: number;
  title: string;
  html_url: string;
  approved: boolean;
  approvedBy: string | null;
  creator: string;
}

async function getIssues(repo: string, usernames: string[]): Promise<Issue[]> {
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
        });
      }
    } catch (error) {
      console.error(`Error fetching issues for ${username} from ${repo}:`, error);
    }
  }

  return issues;
}

export default async function Home() {
  const usernames = process.env.GITHUB_USERNAMES?.split(',') || [];
  console.log('Usernames:', usernames);

  const zeppelinIssues = await getIssues('zeppelin', usernames);
  const zeppelinSiteIssues = await getIssues('zeppelin-site', usernames);
  const allIssues = [...zeppelinIssues, ...zeppelinSiteIssues];
  console.log('All Issues:', allIssues);

  return (
    <main className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">GitHub Issues</h1>
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr>
              <th className="py-2 px-4 border-b">Repository</th>
              <th className="py-2 px-4 border-b">Issue #</th>
              <th className="py-2 px-4 border-b">Title</th>
              <th className="py-2 px-4 border-b">Creator</th>
              <th className="py-2 px-4 border-b">Approved</th>
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