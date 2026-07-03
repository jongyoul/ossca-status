import { NextResponse } from 'next/server';
import { getStatusConfig, getStatusItems } from '../../status-data';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Failed to load status data.';
}

export async function GET() {
  try {
    const config = getStatusConfig();
    const items = await getStatusItems(config);

    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
