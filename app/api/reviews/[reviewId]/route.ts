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

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ reviewId: string }> }
) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const rating = Number(body.rating);
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const comment = typeof body.comment === 'string' ? body.comment.trim() : '';
    const { reviewId } = await context.params;

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'rating must be between 1 and 5' }, { status: 400 });
    }

    if (!comment) {
      return NextResponse.json({ error: 'comment is required' }, { status: 400 });
    }

    const review = await prisma.review.findFirst({
      where: { id: reviewId, userId },
      select: {
        id: true,
        productId: true,
      },
    });

    if (!review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    const updatedReview = await prisma.$transaction(async (tx) => {
      const savedReview = await tx.review.update({
        where: { id: reviewId },
        data: {
          rating,
          title: title || null,
          comment,
        },
      });

      await updateProductReviewStats(tx, review.productId);
      return savedReview;
    });

    return NextResponse.json({ review: updatedReview });
  } catch (error) {
    console.error('Error updating review:', error);
    return NextResponse.json({ error: 'Failed to update review' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ reviewId: string }> }
) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { reviewId } = await context.params;

    const review = await prisma.review.findFirst({
      where: { id: reviewId, userId },
      select: {
        id: true,
        productId: true,
      },
    });

    if (!review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.review.delete({
        where: { id: reviewId },
      });

      await updateProductReviewStats(tx, review.productId);
    });

    return NextResponse.json({ message: 'Review deleted successfully' });
  } catch (error) {
    console.error('Error deleting review:', error);
    return NextResponse.json({ error: 'Failed to delete review' }, { status: 500 });
  }
}
