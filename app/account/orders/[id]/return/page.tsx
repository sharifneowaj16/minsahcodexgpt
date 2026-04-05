import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/nextauth';
import prisma from '@/lib/prisma';
import { ReturnRequestClient } from '@/components/account/return-request-client';

interface ReturnRequestPageProps {
  params: Promise<{ id: string }>;
}

async function getReturnRequestData(orderId: string, userId: string) {
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      userId,
    },
    include: {
      items: {
        include: {
          product: {
            select: {
              slug: true,
              images: {
                take: 1,
                orderBy: { sortOrder: 'asc' },
                select: { url: true },
              },
            },
          },
          variant: {
            select: {
              image: true,
            },
          },
        },
      },
      returns: {
        orderBy: { requestDate: 'desc' },
        take: 1,
        include: {
          items: true,
        },
      },
    },
  });

  if (!order) {
    return null;
  }

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status.toLowerCase(),
    createdAt: order.createdAt,
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.name,
      productSlug: item.product?.slug ?? item.productId,
      productImage: item.variant?.image ?? item.product?.images?.[0]?.url ?? null,
      quantity: item.quantity,
      price: Number(item.price),
      totalPrice: Number(item.total),
      sku: item.sku,
    })),
    latestReturn: order.returns[0]
      ? {
          id: order.returns[0].id,
          returnNumber: order.returns[0].returnNumber,
          status: order.returns[0].status.toLowerCase(),
          reason: order.returns[0].reason,
          refundAmount: Number(order.returns[0].refundAmount),
          requestDate: order.returns[0].requestDate,
          images: order.returns[0].images,
          items: order.returns[0].items.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            price: Number(item.price),
          })),
        }
      : null,
  };
}

export default async function ReturnRequestPage({ params }: ReturnRequestPageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect('/login?redirect=/account/orders');
  }

  const { id } = await params;
  const order = await getReturnRequestData(id, session.user.id);

  if (!order) {
    notFound();
  }

  if (!['delivered', 'shipped'].includes(order.status)) {
    redirect(`/account/orders/${order.id}`);
  }

  return <ReturnRequestClient order={order} />;
}
