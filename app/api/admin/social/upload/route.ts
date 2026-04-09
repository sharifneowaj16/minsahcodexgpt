import { NextRequest, NextResponse } from 'next/server';
import { adminUnauthorizedResponse, getVerifiedAdmin } from '@/app/api/admin/_utils';
import { ensureBucketInitialized, uploadFile } from '@/lib/storage/minio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

function isAllowedMediaType(type: string) {
  return type.startsWith('image/') || type.startsWith('video/') || type.startsWith('audio/');
}

export async function POST(request: NextRequest) {
  const admin = await getVerifiedAdmin(request);
  if (!admin) {
    return adminUnauthorizedResponse();
  }

  try {
    await ensureBucketInitialized();
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!isAllowedMediaType(file.type)) {
      return NextResponse.json(
        { error: 'Only image, video, and audio files are supported' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'File must be 25MB or smaller' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const folder = `media/social/outgoing/${admin.adminId}`;
    const result = await uploadFile(buffer, file.name, folder, file.type);

    return NextResponse.json({
      success: true,
      key: result.key,
      url: result.url,
      mimeType: file.type,
      fileName: file.name,
      size: file.size,
    });
  } catch (error) {
    console.error('Social upload error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Upload failed',
      },
      { status: 500 }
    );
  }
}
