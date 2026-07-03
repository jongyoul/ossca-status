import type { PublicStatusConfig, StatusItem } from './status-data';

interface StatusViewProps {
  config: PublicStatusConfig;
  error?: string | null;
  items: StatusItem[];
}

interface StatusSummaryProps {
  config: PublicStatusConfig;
  items: StatusItem[] | null;
}

interface StatusDataLoadingProps {
  error?: string | null;
  prCountStartDateLabel: string;
}

interface StatusSummaryStats {
  totalPullRequests: number;
  menteeAuthoredPullRequests: number;
  mentorAuthoredPullRequests: number;
  mergedPullRequests: number;
  unmergedPullRequests: number;
}

function formatDate(dateValue: string): string {
  return new Date(dateValue).toISOString().slice(0, 10);
}

function formatBoolean(value: boolean): string {
  return value ? 'Yes' : 'No';
}

function getStatusSummaryStats(items: StatusItem[]): StatusSummaryStats {
  const totalPullRequests = items.length;
  const menteeAuthoredPullRequests = items.filter((pullRequest) =>
    pullRequest.creatorRole.includes('Mentee'),
  ).length;
  const mentorAuthoredPullRequests = items.filter((pullRequest) =>
    pullRequest.creatorRole.includes('Mentor'),
  ).length;
  const mergedPullRequests = items.filter((pullRequest) => pullRequest.merged).length;

  return {
    totalPullRequests,
    menteeAuthoredPullRequests,
    mentorAuthoredPullRequests,
    mergedPullRequests,
    unmergedPullRequests: totalPullRequests - mergedPullRequests,
  };
}

function SummaryValue({ value }: { value: number | string | null }) {
  return (
    <td className="py-2 px-4 border-b">
      {value === null ? (
        <span className="text-gray-500 dark:text-gray-400">Loading...</span>
      ) : (
        value
      )}
    </td>
  );
}

export function StatusSummary({ config, items }: StatusSummaryProps) {
  const stats = items ? getStatusSummaryStats(items) : null;
  const rows: Array<[string, number | string | null]> = [
    ['Tracked Mentees', config.menteeCount],
    ['Tracked Mentors', config.mentorCount],
    ['Tracked Authors', config.trackedAuthorCount],
    ['PR Count Start Date', config.prCountStartDateLabel],
    ['PRs Created Since Start', stats?.totalPullRequests ?? null],
    ['Mentee Authored PRs', stats?.menteeAuthoredPullRequests ?? null],
    ['Mentor Authored PRs', stats?.mentorAuthoredPullRequests ?? null],
    ['Merged PRs', stats?.mergedPullRequests ?? null],
    ['Unmerged PRs', stats?.unmergedPullRequests ?? null],
  ];

  return (
    <div className="mb-4">
      <table className="min-w-full border border-gray-300">
        <thead>
          <tr>
            <th className="py-2 px-4 border-b">Category</th>
            <th className="py-2 px-4 border-b">Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <td className="py-2 px-4 border-b">{label}</td>
              <SummaryValue value={value} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StatusDataLoading({
  error,
  prCountStartDateLabel,
}: StatusDataLoadingProps) {
  return (
    <div className="overflow-x-auto">
      <h2 className="text-xl font-semibold mb-2">
        PRs Created Since {prCountStartDateLabel}
      </h2>
      <p className="border border-gray-300 p-4">
        {error ?? 'Loading GitHub data...'}
      </p>
    </div>
  );
}

export function StatusDataView({
  config,
  error,
  items,
}: StatusViewProps) {
  return (
    <>
      <StatusSummary config={config} items={items} />
      {error ? (
        <p className="border border-gray-300 p-4 mb-4">
          {error}
        </p>
      ) : null}
      <div className="overflow-x-auto">
        <h2 className="text-xl font-semibold mb-2">
          PRs Created Since {config.prCountStartDateLabel}
        </h2>
        {items.length === 0 ? (
          <p className="border border-gray-300 p-4">
            No tracked PRs have been created since {config.prCountStartDateLabel}.
          </p>
        ) : (
          <table className="min-w-full">
            <thead>
              <tr>
                <th className="py-2 px-4 border-b">Repository</th>
                <th className="py-2 px-4 border-b">PR #</th>
                <th className="py-2 px-4 border-b">Title</th>
                <th className="py-2 px-4 border-b">Creator</th>
                <th className="py-2 px-4 border-b">Creator Role</th>
                <th className="py-2 px-4 border-b">Created</th>
                <th className="py-2 px-4 border-b">Merged</th>
                <th className="py-2 px-4 border-b">Link</th>
              </tr>
            </thead>
            <tbody>
              {items.map((pullRequest) => (
                <tr key={`${pullRequest.repo}-${pullRequest.number}`}>
                  <td className="py-2 px-4 border-b">{pullRequest.repo}</td>
                  <td className="py-2 px-4 border-b">{pullRequest.number}</td>
                  <td className="py-2 px-4 border-b">{pullRequest.title}</td>
                  <td className="py-2 px-4 border-b">{pullRequest.creator}</td>
                  <td className="py-2 px-4 border-b">{pullRequest.creatorRole}</td>
                  <td className="py-2 px-4 border-b">
                    {formatDate(pullRequest.createdAt)}
                  </td>
                  <td className="py-2 px-4 border-b">{formatBoolean(pullRequest.merged)}</td>
                  <td className="py-2 px-4 border-b">
                    <a
                      href={pullRequest.htmlUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      View on GitHub
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
