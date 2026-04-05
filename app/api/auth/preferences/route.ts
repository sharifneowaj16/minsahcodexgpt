import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthenticatedUserId, serializeUserProfile, userProfileSelect } from '@/app/api/auth/_utils';

type PreferenceKey = 'newsletter' | 'smsNotifications' | 'promotions' | 'newProducts' | 'orderUpdates';

const PREFERENCE_KEYS: PreferenceKey[] = [
  'newsletter',
  'smsNotifications',
  'promotions',
  'newProducts',
  'orderUpdates',
];

export async function PATCH(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const incoming = body?.preferences;

    if (!incoming || typeof incoming !== 'object') {
      return NextResponse.json({ error: 'Preferences payload is required' }, { status: 400 });
    }

    const updates = Object.fromEntries(
      PREFERENCE_KEYS
        .filter((key) => typeof incoming[key] === 'boolean')
        .map((key) => [key, incoming[key]])
    );

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid preferences provided' }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updates,
      select: userProfileSelect,
    });

    const serializedUser = serializeUserProfile(user);

    return NextResponse.json({
      message: 'Preferences updated successfully',
      preferences: serializedUser.preferences,
      user: serializedUser,
    });
  } catch (error) {
    console.error('Error updating preferences:', error);
    return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
  }
}
