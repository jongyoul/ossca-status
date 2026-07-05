'use client';

import { useMemo, useState } from 'react';
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

type MergeSortDirection = 'default' | 'unmerged-first' | 'merged-first';

const mergeSortLabels: Record<MergeSortDirection, string> = {
  default: 'Default',
  'unmerged-first': 'No first',
  'merged-first': 'Yes first',
};

const mergeSortAriaValues: Record<
  MergeSortDirection,
  'none' | 'ascending' | 'descending'
> = {
  default: 'none',
  'unmerged-first': 'ascending',
  'merged-first': 'descending',
};

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

function compareDefaultStatusItems(a: StatusItem, b: StatusItem): number {
  if (a.repo < b.repo) return -1;
  if (a.repo > b.repo) return 1;
  return b.number - a.number;
}

function getNextMergeSortDirection(
  direction: MergeSortDirection,
): MergeSortDirection {
  if (direction === 'default') return 'unmerged-first';
  if (direction === 'unmerged-first') return 'merged-first';
  return 'default';
}

function getSortedItems(
  items: StatusItem[],
  mergeSortDirection: MergeSortDirection,
): StatusItem[] {
  if (mergeSortDirection === 'default') return items;

  return [...items].sort((a, b) => {
    const mergeComparison =
      mergeSortDirection === 'unmerged-first'
        ? Number(a.merged) - Number(b.merged)
        : Number(b.merged) - Number(a.merged);

    return mergeComparison || compareDefaultStatusItems(a, b);
  });
}

function MergedStatusBadge({ merged }: { merged: boolean }) {
  return (
    <span
      className={`status-badge ${
        merged ? 'status-badge-merged' : 'status-badge-unmerged'
      }`}
    >
      {formatBoolean(merged)}
    </span>
  );
}

function SummaryValue({ value }: { value: number | string | null }) {
  return (
    <td className="status-cell">
      {value === null ? (
        <span className="status-muted">Loading...</span>
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
    <section className="status-section">
      <table className="status-table">
        <thead>
          <tr>
            <th className="status-header-cell">Category</th>
            <th className="status-header-cell">Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <td className="status-cell">{label}</td>
              <SummaryValue value={value} />
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function StatusDataLoading({
  error,
  prCountStartDateLabel,
}: StatusDataLoadingProps) {
  return (
    <div className="overflow-x-auto">
      <h2 className="status-section-title">
        PRs Created Since {prCountStartDateLabel}
      </h2>
      <p className="status-message">
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
  const [mergeSortDirection, setMergeSortDirection] =
    useState<MergeSortDirection>('default');
  const sortedItems = useMemo(
    () => getSortedItems(items, mergeSortDirection),
    [items, mergeSortDirection],
  );

  return (
    <>
      <StatusSummary config={config} items={items} />
      {error ? (
        <p className="status-message status-message-error">
          {error}
        </p>
      ) : null}
      <div className="overflow-x-auto">
        <h2 className="status-section-title">
          PRs Created Since {config.prCountStartDateLabel}
        </h2>
        {items.length === 0 ? (
          <p className="status-message">
            No tracked PRs have been created since {config.prCountStartDateLabel}.
          </p>
        ) : (
          <table className="status-table">
            <thead>
              <tr>
                <th className="status-header-cell">Repository</th>
                <th className="status-header-cell">PR #</th>
                <th className="status-header-cell">Title</th>
                <th className="status-header-cell">Creator</th>
                <th className="status-header-cell">Creator Role</th>
                <th className="status-header-cell">Created</th>
                <th
                  className="status-header-cell"
                  aria-sort={mergeSortAriaValues[mergeSortDirection]}
                >
                  <button
                    type="button"
                    className={`sort-button ${
                      mergeSortDirection === 'default' ? '' : 'sort-button-active'
                    }`}
                    aria-label={`Sort by merge status: ${mergeSortLabels[mergeSortDirection]}`}
                    onClick={() =>
                      setMergeSortDirection((direction) =>
                        getNextMergeSortDirection(direction),
                      )
                    }
                  >
                    <span>Merged</span>
                    <span className="sort-button-meta">
                      {mergeSortLabels[mergeSortDirection]}
                    </span>
                  </button>
                </th>
                <th className="status-header-cell">Link</th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((pullRequest) => (
                <tr key={`${pullRequest.repo}-${pullRequest.number}`}>
                  <td className="status-cell">{pullRequest.repo}</td>
                  <td className="status-cell status-number">{pullRequest.number}</td>
                  <td className="status-cell">{pullRequest.title}</td>
                  <td className="status-cell">{pullRequest.creator}</td>
                  <td className="status-cell">{pullRequest.creatorRole}</td>
                  <td className="status-cell status-number">
                    {formatDate(pullRequest.createdAt)}
                  </td>
                  <td className="status-cell">
                    <MergedStatusBadge merged={pullRequest.merged} />
                  </td>
                  <td className="status-cell">
                    <a
                      href={pullRequest.htmlUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="status-link"
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
