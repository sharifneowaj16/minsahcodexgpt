import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAdminAccessToken } from '@/lib/auth/jwt';
import { Prisma } from '@/generated/prisma/client';

export const dynamic = 'force-dynamic';

async function verifyAdmin(request: NextRequest) {
  const accessToken = request.cookies.get('admin_access_token')?.value;
  if (!accessToken) {
    return null;
  }

  return verifyAdminAccessToken(accessToken);
}

// GET /api/admin/orders/returns - List all return requests
export async function GET(request: NextRequest) {
  try {
    const payload = await verifyAdmin(request);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';

    const where: Prisma.ReturnWhereInput = {};

    if (status && status !== 'all') {
      where.status = status.toUpperCase() as Prisma.ReturnWhereInput['status'];
    }

    if (search) {
      where.OR = [
        { returnNumber: { contains: search, mode: 'insensitive' } },
        { order: { orderNumber: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { user: { firstName: { contains: search, mode: 'insensitive' } } },
        { user: { lastName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [returns, totalCount, pendingCount, approvedCount, totalRefund] = await Promise.all([
      prisma.return.findMany({
        where,
        orderBy: { requestDate: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          order: {
            select: {
              orderNumber: true,
              paymentStatus: true,
              paymentMethod: true,
              paidAt: true,
              createdAt: true,
              updatedAt: true,
            },
          },
          items: true,
        },
      }),
      prisma.return.count(),
      prisma.return.count({ where: { status: 'PENDING' } }),
      prisma.return.count({ where: { status: 'APPROVED' } }),
      prisma.return.aggregate({ _sum: { refundAmount: true } }),
    ]);

    const formatted = returns.map((ret) => ({
      id: ret.returnNumber,
      dbId: ret.id,
      orderId: ret.order.orderNumber,
      customer: {
        name: `${ret.user.firstName || ''} ${ret.user.lastName || ''}`.trim() || ret.user.email,
        email: ret.user.email,
      },
      items: ret.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price.toNumber(),
      })),
      reason: ret.reason,
      status: ret.status.toLowerCase(),
      refundAmount: ret.refundAmount.toNumber(),
      requestDate: ret.requestDate.toISOString(),
      updatedAt: ret.updatedAt.toISOString(),
      notes: ret.adminNote || undefined,
      images: ret.images,
      paymentStatus: ret.order.paymentStatus.toLowerCase(),
      paymentMethod: ret.order.paymentMethod || undefined,
      paidAt: ret.order.paidAt?.toISOString(),
      orderCreatedAt: ret.order.createdAt.toISOString(),
      orderUpdatedAt: ret.order.updatedAt.toISOString(),
    }));

    return NextResponse.json({
      returns: formatted,
      stats: {
        total: totalCount,
        pending: pendingCount,
        approved: approvedCount,
        totalRefundAmount: totalRefund._sum.refundAmount?.toNumber() || 0,
      },
    });
  } catch (error) {
    console.error('Admin returns GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/admin/orders/returns - Bulk update return status
export async function PATCH(request: NextRequest) {
  try {
    const payload = await verifyAdmin(request);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const body = await request.json();
    const ids = Array.isArray(body.ids)
      ? (body.ids as unknown[]).filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
      : [];
    const status = typeof body.status === 'string' ? body.status.trim() : '';
    const adminNote =
      typeof body.adminNote === 'string' && body.adminNote.trim().length > 0
        ? body.adminNote.trim()
        : undefined;

    if (ids.length === 0) {
      return NextResponse.json({ error: 'At least one return id is required' }, { status: 400 });
    }

    if (!status) {
      return NextResponse.json({ error: 'status is required' }, { status: 400 });
    }

    const statusMap: Record<string, string> = {
      pending: 'PENDING',
      approved: 'APPROVED',
      rejected: 'REJECTED',
      processing: 'PROCESSING',
      completed: 'COMPLETED',
    };

    const normalizedStatus = statusMap[status.toLowerCase()] || status.toUpperCase();

    const existingReturns = await prisma.return.findMany({
      where: {
        OR: [{ id: { in: ids } }, { returnNumber: { in: ids } }],
      },
      select: {
        id: true,
        returnNumber: true,
      },
    });

    if (existingReturns.length === 0) {
      return NextResponse.json({ error: 'No matching return requests found' }, { status: 404 });
    }

    await prisma.return.updateMany({
      where: {
        id: { in: existingReturns.map((item) => item.id) },
      },
      data: {
        status: normalizedStatus as any,
        ...(adminNote !== undefined ? { adminNote } : {}),
      },
    });

    return NextResponse.json({
      success: true,
      updatedCount: existingReturns.length,
      status: normalizedStatus.toLowerCase(),
      adminNote,
      ids: existingReturns.map((item) => item.returnNumber),
    });
  } catch (error) {
    console.error('Admin returns bulk PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
