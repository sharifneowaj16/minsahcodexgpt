import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/nextauth';
import prisma from '@/lib/prisma';
import { WishlistClient } from '@/components/account/wishlist-client';

async function getWishlistItems(userId: string) {
  const wishlistItems = await prisma.wishlistItem.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          price: true,
          salePrice: true,
          compareAtPrice: true,
          quantity: true,
          trackInventory: true,
          allowBackorder: true,
          averageRating: true,
          reviewCount: true,
          images: {
            take: 1,
            orderBy: { sortOrder: 'asc' },
            select: { url: true },
          },
          category: {
            select: { name: true },
          },
        },
      },
    },
  });

  return wishlistItems.map((item) => {
    const activePrice = Number(item.product.salePrice ?? item.product.price);
    const comparePrice = item.product.compareAtPrice != null
      ? Number(item.product.compareAtPrice)
      : null;
    const discount = comparePrice && comparePrice > activePrice
      ? Math.round(((comparePrice - activePrice) / comparePrice) * 100)
      : undefined;

    return {
      id: item.id,
      productId: item.productId,
      productName: item.product.name,
      productImage: item.product.images[0]?.url ?? null,
      price: activePrice,
      originalPrice: comparePrice,
      inStock: !item.product.trackInventory || item.product.quantity > 0 || item.product.allowBackorder,
      addedAt: item.createdAt,
      category: item.product.category?.name ?? 'Uncategorized',
      rating: Number(item.product.averageRating ?? 0),
      reviewCount: item.product.reviewCount,
      discount,
    };
  });
}

export default async function WishlistPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect('/login?redirect=/account/wishlist');
  }

  const wishlistItems = await getWishlistItems(session.user.id);

  return <WishlistClient initialItems={wishlistItems} />;
}
