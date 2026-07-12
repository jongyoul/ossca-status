import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { requestMock } = vi.hoisted(() => ({
  requestMock: vi.fn(),
}));

vi.mock('next/cache', () => ({
  unstable_cache: <Args extends unknown[], Result>(
    callback: (...args: Args) => Promise<Result>,
  ) => callback,
}));

vi.mock('octokit', () => ({
  Octokit: class {
    request = requestMock;
  },
}));

import { getStatusItems, type StatusConfig } from './status-data';

const config: StatusConfig = {
  mentees: ['tracked-user'],
  mentors: [],
  trackedAuthors: ['tracked-user'],
  prCountStartDateLabel: '2026-01-01',
};

function makePullRequest(
  number: number,
  state: 'open' | 'closed',
  mergedAt: string | null,
) {
  return {
    number,
    title: `PR ${number}`,
    html_url: `https://github.com/apache/zeppelin/pull/${number}`,
    created_at: '2026-07-01T00:00:00Z',
    state,
    merged_at: mergedAt,
    user: { login: 'tracked-user' },
  };
}

describe('getStatusItems', () => {
  beforeEach(() => {
    process.env.GITHUB_TOKEN = 'test-token';
    requestMock.mockReset();
    requestMock.mockImplementation(
      async (_route: string, request: { repo: string; page: number }) => {
        if (request.repo !== 'zeppelin' || request.page !== 1) {
          return { data: [] };
        }

        return {
          data: [
            makePullRequest(1, 'open', null),
            makePullRequest(2, 'closed', null),
            makePullRequest(3, 'closed', '2026-07-02T00:00:00Z'),
          ],
        };
      },
    );
  });

  afterEach(() => {
    delete process.env.GITHUB_TOKEN;
  });

  it('keeps open and merged PRs while excluding closed unmerged PRs', async () => {
    const items = await getStatusItems(config);

    expect(items.map(({ number, merged }) => ({ number, merged }))).toEqual([
      { number: 3, merged: true },
      { number: 1, merged: false },
    ]);
    expect(requestMock).toHaveBeenCalledWith(
      'GET /repos/{owner}/{repo}/pulls',
      expect.objectContaining({ state: 'all' }),
    );
  });
});
