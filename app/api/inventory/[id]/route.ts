import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEPRECATION_DATE = '2026-04-04';
const REPLACEMENT_PATH = '/api/admin/inventory';

function deprecatedResponse(request: NextRequest, id: string) {
  const replacementUrl = new URL(REPLACEMENT_PATH, request.url);

  const response = NextResponse.json(
    {
      error: 'This inventory item endpoint has been deprecated.',
      deprecatedAt: DEPRECATION_DATE,
      replacement: replacementUrl.toString(),
      replacementPayload: {
        ids: [id],
        action: 'add | remove | set | reorder',
      },
      message: 'Send this update through the admin inventory workspace endpoint.',
    },
    { status: 410 }
  );

  response.headers.set('X-Deprecated-Endpoint', REPLACEMENT_PATH);
  response.headers.set('Sunset', DEPRECATION_DATE);

  return response;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return deprecatedResponse(request, id);
}
