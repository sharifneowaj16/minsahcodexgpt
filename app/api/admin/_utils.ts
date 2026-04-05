import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { verifyAdminAccessToken } from '@/lib/auth/jwt';

export type VerifiedAdmin = {
  adminId: string;
  email: string;
  role: string;
};

export async function getVerifiedAdmin(request: NextRequest): Promise<VerifiedAdmin | null> {
  const accessToken = request.cookies.get('admin_access_token')?.value;
  if (!accessToken) {
    return null;
  }

  const payload = await verifyAdminAccessToken(accessToken);
  if (!payload) {
    return null;
  }

  return {
    adminId: payload.adminId,
    email: payload.email,
    role: payload.role,
  };
}

export function adminUnauthorizedResponse() {
  return NextResponse.json({ error: 'Invalid or expired admin token' }, { status: 401 });
}

export function parseNonNegativeInt(value: unknown, fallback = 0) {
  const parsed = parseInt(String(value), 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

export function parseMoney(value: unknown, label: string) {
  const parsed = Number.parseFloat(String(value));
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new Error(`Invalid ${label}`);
  }
  return parsed;
}

export function escapeLikeInput(value: string) {
  return value.replace(/[%_]/g, '\\$&');
}
