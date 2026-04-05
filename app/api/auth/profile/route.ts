import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthenticatedUserId, serializeUserProfile, userProfileSelect } from '@/app/api/auth/_utils';

const ALLOWED_GENDERS = new Set(['male', 'female', 'other']);

export async function PATCH(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : '';
    const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const rawDateOfBirth = typeof body.dateOfBirth === 'string' ? body.dateOfBirth.trim() : '';
    const rawGender = typeof body.gender === 'string' ? body.gender.trim().toLowerCase() : '';

    if (!firstName) {
      return NextResponse.json({ error: 'First name is required' }, { status: 400 });
    }

    let dateOfBirth: Date | null = null;
    if (rawDateOfBirth) {
      const parsed = new Date(rawDateOfBirth);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: 'Invalid date of birth' }, { status: 400 });
      }
      dateOfBirth = parsed;
    }

    if (rawGender && !ALLOWED_GENDERS.has(rawGender)) {
      return NextResponse.json({ error: 'Invalid gender value' }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        firstName,
        lastName: lastName || null,
        phone: phone || null,
        dateOfBirth,
        gender: rawGender || null,
      },
      select: userProfileSelect,
    });

    return NextResponse.json({
      message: 'Profile updated successfully',
      user: serializeUserProfile(user),
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
