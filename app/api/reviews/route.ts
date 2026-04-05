import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { getAuthenticatedUserId } from '@/app/api/auth/_utils';

async function updateProductReviewStats(tx: Prisma.TransactionClient, productId: string) {
  const remainingReviews = await tx.review.findMany({
    where: { productId },
    select: { rating: true },
  });

  const reviewCount = remainingReviews.length;
  const averageRating = reviewCount > 0
    ? remainingReviews.reduce((sum, item) => sum + item.rating, 0) / reviewCount
    : null;

  await tx.product.update({
    where: { id: productId },
    data: {
      reviewCount,
      averageRating,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const productId = typeof body.productId === 'string' ? body.productId : '';
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const comment = typeof body.comment === 'string' ? body.comment.trim() : '';
    const rating = Number(body.rating);

    if (!productId) {
      return NextResponse.json({ error: 'productId is required' }, { status: 400 });
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'rating must be between 1 and 5' }, { status: 400 });
    }

    if (!comment) {
      return NextResponse.json({ error: 'comment is required' }, { status: 400 });
    }

    const [product, existingReview, deliveredOrderItem] = await Promise.all([
      prisma.product.findUnique({
        where: { id: productId },
        select: { id: true },
      }),
      prisma.review.findFirst({
        where: { userId, productId },
        select: { id: true },
      }),
      prisma.orderItem.findFirst({
        where: {
          productId,
          order: {
            userId,
            status: 'DELIVERED',
          },
        },
        select: { id: true },
      }),
    ]);

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    if (existingReview) {
      return NextResponse.json({ error: 'You already reviewed this product' }, { status: 409 });
    }

    if (!deliveredOrderItem) {
      return NextResponse.json({ error: 'You can review only delivered products' }, { status: 403 });
    }

    const review = await prisma.$transaction(async (tx) => {
      const createdReview = await tx.review.create({
        data: {
          userId,
          productId,
          rating,
          title: title || null,
          comment,
          isVerified: true,
        },
      });

      await updateProductReviewStats(tx, productId);
      return createdReview;
    });

    return NextResponse.json({ review }, { status: 201 });
  } catch (error) {
    console.error('Error creating review:', error);
    return NextResponse.json({ error: 'Failed to create review' }, { status: 500 });
  }
}
