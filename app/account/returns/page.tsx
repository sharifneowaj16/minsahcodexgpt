import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/nextauth';
import prisma from '@/lib/prisma';
import { ReturnsClient } from '@/components/account/returns-client';

async function getUserReturns(userId: string) {
  const returns = await prisma.return.findMany({
    where: { userId },
    orderBy: { requestDate: 'desc' },
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
        },
      },
      items: true,
    },
  });

  return returns.map((returnRequest) => ({
    returnId: returnRequest.id,
    id: returnRequest.returnNumber,
    orderId: returnRequest.order.id,
    orderNumber: returnRequest.order.orderNumber,
    status: returnRequest.status.toLowerCase(),
    reason: returnRequest.reason,
    refundAmount: Number(returnRequest.refundAmount),
    requestDate: returnRequest.requestDate,
    updatedAt: returnRequest.updatedAt,
    images: returnRequest.images,
    items: returnRequest.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      price: Number(item.price),
    })),
  }));
}

export default async function AccountReturnsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect('/login?redirect=/account/returns');
  }

  const returns = await getUserReturns(session.user.id);

  return <ReturnsClient returns={returns} />;
}
