import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/nextauth';
import prisma from '@/lib/prisma';
import { LoyaltyClient } from '@/components/account/loyalty-client';
import { LOYALTY_CONFIG } from '@/types/user';

const loyaltyTiers = [
  {
    name: 'Customer',
    minPoints: 0,
    icon: 'Star',
    color: 'gray',
    benefits: ['1 point per BDT spent', 'Birthday bonus: 50 points', 'Standard customer support'],
  },
  {
    name: 'VIP',
    minPoints: 1000,
    icon: 'Heart',
    color: 'purple',
    benefits: ['1.2x points on all purchases', 'Birthday bonus: 100 points', 'Priority customer support', 'Exclusive access to sales', 'Free shipping on orders over BDT 500'],
  },
  {
    name: 'Premium',
    minPoints: 5000,
    icon: 'Crown',
    color: 'yellow',
    benefits: ['1.5x points on all purchases', 'Birthday bonus: 200 points', 'Dedicated customer support', 'Early access to new products', 'Free shipping on all orders', 'Personal beauty consultant', 'Anniversary bonus: 150 points'],
  },
];

const rewards = [
  { id: '1', name: 'BDT 100 Off Coupon', points: 500, description: 'Get BDT 100 off your next purchase', category: 'discount' },
  { id: '2', name: 'BDT 200 Off Coupon', points: 900, description: 'Get BDT 200 off your next purchase', category: 'discount' },
  { id: '3', name: 'Free Shipping', points: 300, description: 'Free shipping on your next order', category: 'shipping' },
  { id: '4', name: 'Premium Face Serum', points: 2500, description: 'Redeem our premium face serum', category: 'product' },
  { id: '5', name: 'Beauty Box', points: 3000, description: 'Exclusive curated beauty box', category: 'product' },
];

function getTierName(points: number) {
  if (points >= 5000) {
    return 'premium';
  }

  if (points >= 1000) {
    return 'vip';
  }

  return 'customer';
}

async function getLoyaltyData(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      createdAt: true,
      loyaltyPoints: true,
      orders: {
        where: { status: 'DELIVERED' },
        orderBy: { deliveredAt: 'desc' },
        select: {
          id: true,
          orderNumber: true,
          total: true,
          createdAt: true,
          deliveredAt: true,
        },
      },
      reviews: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          createdAt: true,
          product: {
            select: { name: true },
          },
        },
      },
      referrals: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          createdAt: true,
          orders: {
            where: { status: 'DELIVERED' },
            orderBy: { deliveredAt: 'asc' },
            take: 1,
            select: {
              id: true,
              createdAt: true,
              deliveredAt: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    redirect('/login?redirect=/account/loyalty');
  }

  const transactions = [
    {
      id: `signup-${user.id}`,
      type: 'earned' as const,
      points: LOYALTY_CONFIG.points_for_signup,
      description: 'Welcome bonus for signing up',
      createdAt: user.createdAt,
    },
    ...user.orders.map((order) => ({
      id: `order-${order.id}`,
      type: 'earned' as const,
      points: Math.max(Math.round(Number(order.total) * LOYALTY_CONFIG.points_per_bdt), 0),
      description: `Order #${order.orderNumber}`,
      orderId: order.orderNumber,
      createdAt: order.deliveredAt ?? order.createdAt,
    })),
    ...user.reviews.map((review) => ({
      id: `review-${review.id}`,
      type: 'earned' as const,
      points: LOYALTY_CONFIG.points_for_review,
      description: `Product review for ${review.product.name}`,
      createdAt: review.createdAt,
    })),
    ...user.referrals.flatMap((referral) => {
      const referralName = [referral.firstName, referral.lastName].filter(Boolean).join(' ') || referral.email;
      const signupTransaction = {
        id: `ref-signup-${referral.id}`,
        type: 'earned' as const,
        points: LOYALTY_CONFIG.points_for_referral_signup,
        description: `Referral signup: ${referralName}`,
        createdAt: referral.createdAt,
      };
      const deliveredOrder = referral.orders[0];

      if (!deliveredOrder) {
        return [signupTransaction];
      }

      return [
        signupTransaction,
        {
          id: `ref-purchase-${referral.id}`,
          type: 'earned' as const,
          points: LOYALTY_CONFIG.points_for_referral_purchase,
          description: `Referral purchase: ${referralName}`,
          createdAt: deliveredOrder.deliveredAt ?? deliveredOrder.createdAt,
        },
      ];
    }),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const currentPoints = user.loyaltyPoints;
  const nextTier = loyaltyTiers.find((tier) => tier.minPoints > currentPoints);
  const currentTierMinPoints = [...loyaltyTiers]
    .reverse()
    .find((tier) => currentPoints >= tier.minPoints)?.minPoints ?? 0;
  const pointsNeededForNextTier = nextTier ? Math.max(nextTier.minPoints - currentPoints, 0) : 0;
  const tierProgress = nextTier
    ? ((currentPoints - currentTierMinPoints) / (nextTier.minPoints - currentTierMinPoints)) * 100
    : 100;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthlyEarned = transactions
    .filter((transaction) => new Date(transaction.createdAt) >= startOfMonth)
    .reduce((sum, transaction) => sum + transaction.points, 0);

  return {
    userLoyalty: {
      currentPoints,
      lifetimePoints: currentPoints,
      tier: getTierName(currentPoints),
      nextTierPoints: pointsNeededForNextTier,
      tierProgress,
      monthlyEarned,
      pointsExpiring: 0,
      expiryDate: new Date(now.getTime() + LOYALTY_CONFIG.points_expiry_days * 24 * 60 * 60 * 1000),
    },
    transactions,
  };
}

export default async function LoyaltyPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect('/login?redirect=/account/loyalty');
  }

  const data = await getLoyaltyData(session.user.id);

  return (
    <LoyaltyClient
      userLoyalty={data.userLoyalty}
      transactions={data.transactions}
      loyaltyTiers={loyaltyTiers}
      rewards={rewards}
    />
  );
}
