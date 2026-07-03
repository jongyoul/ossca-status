'use client';

import { useEffect, useState } from 'react';
import type { PublicStatusConfig, StatusItem } from './status-data';
import { StatusDataLoading, StatusDataView, StatusSummary } from './status-view';

const STATUS_REFRESH_INTERVAL_MS = 30_000;

interface StatusClientProps {
  config: PublicStatusConfig;
}

interface StatusApiResponse {
  items: StatusItem[];
}

async function fetchStatusItems(signal: AbortSignal): Promise<StatusItem[]> {
  const response = await fetch('/api/status', {
    cache: 'no-store',
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to load status data: ${response.status}`);
  }

  const data = (await response.json()) as StatusApiResponse;
  return data.items;
}

export function StatusClient({ config }: StatusClientProps) {
  const [items, setItems] = useState<StatusItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let currentController: AbortController | null = null;

    async function loadStatus() {
      currentController?.abort();
      currentController = new AbortController();

      try {
        const nextItems = await fetchStatusItems(currentController.signal);
        if (!active) return;

        setItems(nextItems);
        setError(null);
      } catch (loadError) {
        if (!active || currentController.signal.aborted) return;

        setError(
          loadError instanceof Error ? loadError.message : 'Failed to load status data.',
        );
      }
    }

    void loadStatus();
    const timer = window.setInterval(() => {
      void loadStatus();
    }, STATUS_REFRESH_INTERVAL_MS);

    return () => {
      active = false;
      currentController?.abort();
      window.clearInterval(timer);
    };
  }, []);

  if (items === null) {
    return (
      <>
        <StatusSummary config={config} items={null} />
        <StatusDataLoading
          error={error}
          prCountStartDateLabel={config.prCountStartDateLabel}
        />
      </>
    );
  }

  return <StatusDataView config={config} error={error} items={items} />;
}
