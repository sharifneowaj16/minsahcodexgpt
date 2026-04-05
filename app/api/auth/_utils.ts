import { getServerSession } from 'next-auth';
import type { NextRequest } from 'next/server';
import { authOptions } from '@/lib/auth/nextauth';
import { verifyAccessToken } from '@/lib/auth/jwt';

export const userProfileSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  dateOfBirth: true,
  gender: true,
  avatar: true,
  role: true,
  status: true,
  emailVerified: true,
  phoneVerified: true,
  loyaltyPoints: true,
  referralCode: true,
  newsletter: true,
  smsNotifications: true,
  promotions: true,
  newProducts: true,
  orderUpdates: true,
  createdAt: true,
  lastLoginAt: true,
};

type UserProfileRecord = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  dateOfBirth: Date | null;
  gender: string | null;
  avatar: string | null;
  role: string;
  status: string;
  emailVerified: Date | null;
  phoneVerified: boolean;
  loyaltyPoints: number;
  referralCode: string | null;
  newsletter: boolean;
  smsNotifications: boolean;
  promotions: boolean;
  newProducts: boolean;
  orderUpdates: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
};

export async function getAuthenticatedUserId(request: NextRequest): Promise<string | null> {
  const tokenFromCookie = request.cookies.get('auth_token')?.value;
  const authHeader = request.headers.get('authorization');
  const tokenFromHeader = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7)
    : null;
  const token = tokenFromCookie || tokenFromHeader;

  if (token) {
    const payload = await verifyAccessToken(token);
    if (payload?.userId) {
      return payload.userId;
    }
  }

  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

export function serializeUserProfile(user: UserProfileRecord) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    dateOfBirth: user.dateOfBirth,
    gender: user.gender,
    avatar: user.avatar,
    role: user.role.toLowerCase(),
    status: user.status.toLowerCase(),
    emailVerified: !!user.emailVerified,
    phoneVerified: user.phoneVerified,
    loyaltyPoints: user.loyaltyPoints,
    referralCode: user.referralCode,
    preferences: {
      newsletter: user.newsletter,
      smsNotifications: user.smsNotifications,
      promotions: user.promotions,
      newProducts: user.newProducts,
      orderUpdates: user.orderUpdates,
    },
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}
