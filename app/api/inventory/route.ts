import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEPRECATION_DATE = '2026-04-04';
const REPLACEMENT_PATH = '/api/admin/inventory';

function deprecatedResponse(request: NextRequest) {
  const replacementUrl = new URL(REPLACEMENT_PATH, request.url);
  replacementUrl.search = new URL(request.url).search;

  const response = NextResponse.json(
    {
      error: 'This inventory endpoint has been deprecated.',
      deprecatedAt: DEPRECATION_DATE,
      replacement: replacementUrl.toString(),
      message: 'Use the admin inventory workspace endpoint instead.',
    },
    { status: 410 }
  );

  response.headers.set('X-Deprecated-Endpoint', REPLACEMENT_PATH);
  response.headers.set('Sunset', DEPRECATION_DATE);

  return response;
}

export async function GET(request: NextRequest) {
  return deprecatedResponse(request);
}

export async function PATCH(request: NextRequest) {
  return deprecatedResponse(request);
}
