import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { createLogger } from '@/lib/logger';
import { getAuthenticatedUserId, serializeUserProfile, userProfileSelect } from '@/app/api/auth/_utils';

const logger = createLogger('auth:me');

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Fetch user from database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: userProfileSelect,
    });

    if (!user) {
      logger.warn('User not found for authenticated request', { userId });
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check user status
    if (user.status !== 'ACTIVE') {
      logger.warn('Inactive user attempted to access profile', { userId: user.id, status: user.status });
      return NextResponse.json(
        { error: 'Account is not active' },
        { status: 403 }
      );
    }

    return NextResponse.json({ user: serializeUserProfile(user) });

  } catch (error) {
    logger.error('Error fetching user profile', error);
    return NextResponse.json(
      { error: 'Failed to fetch user profile' },
      { status: 500 }
    );
  }
}
