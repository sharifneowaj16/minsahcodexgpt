import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/nextauth';
import prisma from '@/lib/prisma';
import { ReviewFormClient } from '@/components/account/review-form-client';

interface ReviewWritePageProps {
  searchParams: Promise<{
    productId?: string;
    orderId?: string;
    reviewId?: string;
  }>;
}

async function getReviewFormData(
  userId: string,
  searchParams: Awaited<ReviewWritePageProps['searchParams']>
) {
  const { productId, orderId, reviewId } = searchParams;

  if (reviewId) {
    const review = await prisma.review.findFirst({
      where: { id: reviewId, userId },
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

    if (!review) {
      redirect('/account/reviews');
    }

    return {
      mode: 'edit' as const,
      reviewId: review.id,
      product: {
        id: review.productId,
        name: review.product.name,
        image: review.product.images[0]?.url ?? null,
      },
      initialValues: {
        rating: review.rating,
        title: review.title ?? '',
        comment: review.comment ?? '',
      },
    };
  }

  if (!productId) {
    redirect('/account/reviews');
  }

  const [product, deliveredOrderItem, existingReview] = await Promise.all([
    prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        images: {
          take: 1,
          orderBy: { sortOrder: 'asc' },
          select: { url: true },
        },
      },
    }),
    prisma.orderItem.findFirst({
      where: {
        productId,
        order: {
          userId,
          status: 'DELIVERED',
          ...(orderId ? { id: orderId } : {}),
        },
      },
      select: { id: true },
    }),
    prisma.review.findFirst({
      where: { userId, productId },
      select: { id: true },
    }),
  ]);

  if (existingReview?.id) {
    redirect(`/account/reviews/write?reviewId=${existingReview.id}`);
  }

  if (!product || !deliveredOrderItem) {
    redirect('/account/reviews');
  }

  return {
    mode: 'create' as const,
    product: {
      id: product.id,
      name: product.name,
      image: product.images[0]?.url ?? null,
    },
    initialValues: {
      rating: 5,
      title: '',
      comment: '',
    },
  };
}

export default async function ReviewWritePage({ searchParams }: ReviewWritePageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect('/login?redirect=/account/reviews');
  }

  const resolvedSearchParams = await searchParams;
  const data = await getReviewFormData(session.user.id, resolvedSearchParams);

  return (
    <ReviewFormClient
      mode={data.mode}
      product={data.product}
      initialValues={data.initialValues}
      reviewId={data.reviewId}
    />
  );
}
