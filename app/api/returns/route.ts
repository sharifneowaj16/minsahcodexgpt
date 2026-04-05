import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthenticatedUserId } from '@/app/api/auth/_utils';

type ReturnItemInput = {
  orderItemId?: unknown;
  quantity?: unknown;
};

function generateReturnNumber() {
  const stamp = Date.now().toString(36).toUpperCase();
  return `RET-${stamp}`;
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const orderId = typeof body.orderId === 'string' ? body.orderId : '';
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    const items: ReturnItemInput[] = Array.isArray(body.items) ? body.items : [];
    const images = Array.isArray(body.images)
      ? (body.images as unknown[]).filter((image): image is string => typeof image === 'string' && image.trim().length > 0)
      : [];

    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    }

    if (!reason) {
      return NextResponse.json({ error: 'reason is required' }, { status: 400 });
    }

    if (items.length === 0) {
      return NextResponse.json({ error: 'Select at least one item' }, { status: 400 });
    }

    if (images.length > 4) {
      return NextResponse.json({ error: 'You can upload up to 4 images' }, { status: 400 });
    }

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId,
      },
      include: {
        items: true,
        returns: {
          orderBy: { requestDate: 'desc' },
          take: 1,
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (!['DELIVERED', 'SHIPPED'].includes(order.status)) {
      return NextResponse.json({ error: 'This order is not eligible for return yet' }, { status: 403 });
    }

    if (order.returns.length > 0) {
      return NextResponse.json({ error: 'A return request already exists for this order' }, { status: 409 });
    }

    const normalizedItems = items
      .map((item) => ({
        orderItemId: typeof item.orderItemId === 'string' ? item.orderItemId : '',
        quantity: Number(item.quantity),
      }))
      .filter((item) => item.orderItemId && Number.isInteger(item.quantity) && item.quantity > 0);

    if (normalizedItems.length === 0) {
      return NextResponse.json({ error: 'No valid return items found' }, { status: 400 });
    }

    const orderItemsById = new Map(order.items.map((item) => [item.id, item]));
    const returnItems = [];

    for (const item of normalizedItems) {
      const orderItem = orderItemsById.get(item.orderItemId);

      if (!orderItem) {
        return NextResponse.json({ error: 'Invalid order item selected' }, { status: 400 });
      }

      if (item.quantity > orderItem.quantity) {
        return NextResponse.json(
          { error: `Return quantity exceeds ordered quantity for ${orderItem.name}` },
          { status: 400 }
        );
      }

      returnItems.push({
        name: orderItem.name,
        quantity: item.quantity,
        price: Number(orderItem.price),
        productId: orderItem.productId,
      });
    }

    const refundAmount = returnItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const createdReturn = await prisma.return.create({
      data: {
        returnNumber: generateReturnNumber(),
        orderId: order.id,
        userId,
        reason,
        refundAmount,
        images,
        items: {
          create: returnItems.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            productId: item.productId,
          })),
        },
      },
      include: {
        items: true,
      },
    });

    return NextResponse.json({
      returnRequest: {
        id: createdReturn.id,
        returnNumber: createdReturn.returnNumber,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating return request:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create return request' },
      { status: 500 }
    );
  }
}
