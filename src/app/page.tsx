import { Octokit } from 'octokit';
import type { Metadata } from 'next';
import { useState } from 'react';

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
  const initialIssues = [...zeppelinIssues, ...zeppelinSiteIssues];

  const [sortConfig, setSortConfig] = useState<{ key: keyof Issue; direction: 'ascending' | 'descending' } | null>(null);

  const sortedIssues = [...initialIssues].sort((a, b) => {
    if (!sortConfig) return 0;

    const aValue = a[sortConfig.key];
    const bValue = b[sortConfig.key];

    if (aValue === null || aValue === undefined) return sortConfig.direction === 'ascending' ? -1 : 1;
    if (bValue === null || bValue === undefined) return sortConfig.direction === 'ascending' ? 1 : -1;

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortConfig.direction === 'ascending' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
    } else if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortConfig.direction === 'ascending' ? aValue - bValue : bValue - aValue;
    } else if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
      return sortConfig.direction === 'ascending' ? (aValue === bValue ? 0 : aValue ? 1 : -1) : (aValue === bValue ? 0 : aValue ? -1 : 1);
    }
    return 0;
  });

  const requestSort = (key: keyof Issue) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const getSortIndicator = (key: keyof Issue) => {
    if (!sortConfig || sortConfig.key !== key) return null;
    return sortConfig.direction === 'ascending' ? ' ⬆️' : ' ⬇️';
  };

  return (
    <main className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">GitHub Issues</h1>
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr>
              <th className="py-2 px-4 border-b cursor-pointer" onClick={() => requestSort('repo')}>Repository{getSortIndicator('repo')}</th>
              <th className="py-2 px-4 border-b cursor-pointer" onClick={() => requestSort('number')}>Issue #{getSortIndicator('number')}</th>
              <th className="py-2 px-4 border-b cursor-pointer" onClick={() => requestSort('title')}>Title{getSortIndicator('title')}</th>
              <th className="py-2 px-4 border-b cursor-pointer" onClick={() => requestSort('creator')}>Creator{getSortIndicator('creator')}</th>
              <th className="py-2 px-4 border-b cursor-pointer" onClick={() => requestSort('approved')}>Approved{getSortIndicator('approved')}</th>
              <th className="py-2 px-4 border-b cursor-pointer" onClick={() => requestSort('merged')}>Merged{getSortIndicator('merged')}</th>
              <th className="py-2 px-4 border-b cursor-pointer" onClick={() => requestSort('approvedBy')}>Approved By{getSortIndicator('approvedBy')}</th>
              <th className="py-2 px-4 border-b">Link</th>
            </tr>
          </thead>
          <tbody>
            {sortedIssues.map((issue) => (
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