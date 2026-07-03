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
    <main className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">OSSCA GitHub Status</h1>
      <StatusClient config={publicConfig} />
    </main>
  );
}
