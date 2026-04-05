import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/nextauth';
import prisma from '@/lib/prisma';
import { OrderDetailClient } from '@/components/account/order-detail-client';

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ print?: string }>;
}

async function getOrderDetails(orderId: string, userId: string) {
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
              id: true,
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
              id: true,
              image: true,
            },
          },
        },
      },
      returns: {
        orderBy: { requestDate: 'desc' },
        take: 1,
        select: {
          id: true,
          returnNumber: true,
          status: true,
          requestDate: true,
          refundAmount: true,
        },
      },
      shippingAddress: true,
      payments: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!order) {
    return null;
  }

  const tracking = [
    {
      timestamp: order.createdAt,
      status: 'ordered',
      description: 'Order placed successfully',
      location: 'Online',
      completed: true,
    },
    {
      timestamp: order.paidAt ?? order.createdAt,
      status: 'confirmed',
      description:
        order.paymentStatus === 'COMPLETED'
          ? 'Payment received and order confirmed'
          : 'Order confirmed and queued for processing',
      location: 'Processing Center',
      completed: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'].includes(order.status),
    },
    {
      timestamp: order.updatedAt,
      status: 'processing',
      description: 'Order is being prepared for shipment',
      location: 'Warehouse',
      completed: ['PROCESSING', 'SHIPPED', 'DELIVERED'].includes(order.status),
    },
    {
      timestamp: order.shippedAt ?? order.updatedAt,
      status: 'shipped',
      description: 'Package shipped to courier',
      location: order.shippingMethod ?? 'Courier Hub',
      completed: ['SHIPPED', 'DELIVERED'].includes(order.status),
    },
    {
      timestamp: order.deliveredAt ?? order.cancelledAt ?? order.updatedAt,
      status: order.status === 'CANCELLED' ? 'cancelled' : 'delivered',
      description:
        order.status === 'CANCELLED' ? 'Order was cancelled' : 'Package delivered successfully',
      location: order.shippingAddress?.city ?? 'Destination',
      completed: ['DELIVERED', 'CANCELLED'].includes(order.status),
    },
  ].filter((event) => event.completed);

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status.toLowerCase(),
    paymentStatus: order.paymentStatus.toLowerCase(),
    paymentMethod: (order.paymentMethod ?? order.payments[0]?.method ?? 'cod').toLowerCase(),
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.name,
      productImage: item.variant?.image ?? item.product?.images?.[0]?.url ?? null,
      quantity: item.quantity,
      price: Number(item.price),
      totalPrice: Number(item.total),
      sku: item.sku,
      productSlug: item.product?.slug ?? item.productId,
    })),
    subtotal: Number(order.subtotal),
    shipping: Number(order.shippingCost),
    tax: Number(order.taxAmount),
    discount: Number(order.discountAmount),
    total: Number(order.total),
    createdAt: order.createdAt,
    estimatedDelivery:
      order.deliveredAt ?? new Date(order.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000),
    deliveredAt: order.deliveredAt,
    trackingNumber: order.trackingNumber ?? undefined,
    carrier: order.shippingMethod ?? 'Standard Delivery',
    steadfastTrackingCode: order.steadfastTrackingCode ?? undefined,
    shippingAddress: order.shippingAddress
      ? {
          firstName: order.shippingAddress.firstName,
          lastName: order.shippingAddress.lastName,
          addressLine1: order.shippingAddress.street1,
          addressLine2: order.shippingAddress.street2,
          city: order.shippingAddress.city,
          state: order.shippingAddress.state,
          postalCode: order.shippingAddress.postalCode,
          country: order.shippingAddress.country,
          phone: order.shippingAddress.phone,
        }
      : null,
    billingAddress: order.shippingAddress
      ? {
          firstName: order.shippingAddress.firstName,
          lastName: order.shippingAddress.lastName,
          addressLine1: order.shippingAddress.street1,
          addressLine2: order.shippingAddress.street2,
          city: order.shippingAddress.city,
          state: order.shippingAddress.state,
          postalCode: order.shippingAddress.postalCode,
          country: order.shippingAddress.country,
          phone: order.shippingAddress.phone,
        }
      : null,
    latestReturn: order.returns[0]
      ? {
          id: order.returns[0].id,
          returnNumber: order.returns[0].returnNumber,
          status: order.returns[0].status.toLowerCase(),
          requestDate: order.returns[0].requestDate,
          refundAmount: Number(order.returns[0].refundAmount),
        }
      : null,
    tracking,
    notes: order.customerNote ?? order.adminNote ?? '',
  };
}

export default async function OrderDetailPage({ params, searchParams }: OrderDetailPageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect('/login?redirect=/account/orders');
  }

  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const order = await getOrderDetails(id, session.user.id);

  if (!order) {
    notFound();
  }

  return <OrderDetailClient order={order} printMode={resolvedSearchParams.print === 'invoice'} />;
}
