import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/nextauth';
import prisma from '@/lib/prisma';
import { ReviewsClient } from '@/components/account/reviews-client';

async function getReviewsData(userId: string) {
  const reviews = await prisma.review.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          images: {
            take: 1,
            orderBy: { sortOrder: 'asc' },
            select: { url: true },
          },
        },
      },
    },
  });

  const reviewedProductIds = new Set(reviews.map((review) => review.productId));

  const deliveredOrderItems = await prisma.orderItem.findMany({
    where: {
      order: {
        userId,
        status: 'DELIVERED',
      },
    },
    orderBy: { order: { createdAt: 'desc' } },
    include: {
      order: {
        select: { createdAt: true },
      },
      product: {
        select: {
          id: true,
          name: true,
          images: {
            take: 1,
            orderBy: { sortOrder: 'asc' },
            select: { url: true },
          },
        },
      },
    },
  });

  const uniqueReviewableProducts = new Map<string, {
    id: string;
    name: string;
    image: string | null;
    orderDate: Date;
    canReview: boolean;
  }>();

  for (const item of deliveredOrderItems) {
    if (!item.product || reviewedProductIds.has(item.productId) || uniqueReviewableProducts.has(item.productId)) {
      continue;
    }

    uniqueReviewableProducts.set(item.productId, {
      id: item.productId,
      name: item.product.name,
      image: item.product.images[0]?.url ?? null,
      orderDate: item.order.createdAt,
      canReview: true,
    });
  }

  return {
    reviews: reviews.map((review) => ({
      id: review.id,
      productId: review.productId,
      productName: review.product.name,
      productImage: review.product.images[0]?.url ?? null,
      rating: review.rating,
      title: review.title ?? 'Untitled review',
      content: review.comment ?? '',
      isVerified: review.isVerified,
      helpfulCount: 0,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
    })),
    reviewableProducts: Array.from(uniqueReviewableProducts.values()),
  };
}

export default async function ReviewsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect('/login?redirect=/account/reviews');
  }

  const data = await getReviewsData(session.user.id);

  return <ReviewsClient reviews={data.reviews} reviewableProducts={data.reviewableProducts} />;
}
