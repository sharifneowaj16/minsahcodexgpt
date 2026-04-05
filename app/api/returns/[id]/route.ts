import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthenticatedUserId } from '@/app/api/auth/_utils';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const existingReturn = await prisma.return.findFirst({
      where: {
        userId,
        OR: [{ id }, { returnNumber: id }],
      },
      select: {
        id: true,
        returnNumber: true,
        status: true,
      },
    });

    if (!existingReturn) {
      return NextResponse.json({ error: 'Return request not found' }, { status: 404 });
    }

    if (existingReturn.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Only pending return requests can be cancelled' },
        { status: 409 }
      );
    }

    await prisma.return.delete({
      where: { id: existingReturn.id },
    });

    return NextResponse.json({
      success: true,
      returnNumber: existingReturn.returnNumber,
    });
  } catch (error) {
    console.error('Error cancelling return request:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to cancel return request' },
      { status: 500 }
    );
  }
}
