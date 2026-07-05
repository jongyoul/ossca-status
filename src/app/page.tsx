import type { Metadata } from 'next';
import { connection } from 'next/server';
import { StatusClient } from './status-client';
import { getPublicStatusConfig, getStatusConfig } from './status-data';

export const metadata: Metadata = {
  title: 'OSSCA Status',
  description: 'Open Source Contribution Status for OSSCA members',
  openGraph: {
    title: 'OSSCA Status',
    description: 'Open Source Contribution Status for OSSCA members',
    images: [
      {
        url: '/thumbnail.png',
        width: 462,
        height: 313,
        alt: 'OSSCA Status Thumbnail',
      },
    ],
  },
};

export default async function Home() {
  await connection();

  const config = getStatusConfig();
  const publicConfig = getPublicStatusConfig(config);

  console.log(
    `Loaded ${config.mentees.length} mentees, ${config.mentors.length} mentors, and ${config.trackedAuthors.length} tracked authors.`,
  );

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <h1 className="mb-4 text-2xl font-bold tracking-normal">
          OSSCA GitHub Status
        </h1>
        <StatusClient config={publicConfig} />
      </div>
    </main>
  );
}
