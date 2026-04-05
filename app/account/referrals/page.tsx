import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/nextauth';
import prisma from '@/lib/prisma';
import { ReferralsClient } from '@/components/account/referrals-client';
import { LOYALTY_CONFIG } from '@/types/user';

const shareOptions = [
  { name: 'Copy Link', icon: 'Copy', action: 'copy' },
  { name: 'Email', icon: 'Mail', action: 'email' },
  { name: 'Facebook', icon: 'Facebook', action: 'facebook' },
  { name: 'Twitter', icon: 'Twitter', action: 'twitter' },
];

const emailTemplates = [
  {
    id: 'personal',
    name: 'Personal Message',
    subject: 'Join me at Minsah Beauty!',
    body: 'Hi there!\n\nI wanted to share this amazing beauty brand with you - Minsah Beauty. They have incredible toxin-free skincare and makeup products that I absolutely love.\n\nUse my referral code {referralCode} to get a special welcome bonus when you sign up!\n\nCheck them out here: {referralLink}\n\nBest regards,\n{senderName}',
  },
  {
    id: 'casual',
    name: 'Casual Invite',
    subject: "You've got to check this out!",
    body: "Hey!\n\nFound this awesome beauty store called Minsah Beauty and thought you would love it. Amazing products, great prices, and they're all about clean beauty.\n\nUse my code {referralCode} for a discount on your first order. Here's the link: {referralLink}\n\nEnjoy!",
  },
];

function getReferralCodeFallback(userId: string) {
  return `REF${userId.slice(-6).toUpperCase()}`;
}

async function getReferralsData(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      referralCode: true,
      referrals: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          createdAt: true,
          orders: {
            where: {
              status: {
                notIn: ['CANCELLED', 'REFUNDED'],
              },
            },
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              status: true,
              createdAt: true,
              deliveredAt: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    redirect('/login?redirect=/account/referrals');
  }

  const referralCode = user.referralCode ?? getReferralCodeFallback(user.id);
  const referralLink = `${process.env.NEXT_PUBLIC_APP_URL || 'https://minsahbeauty.cloud'}/register?ref=${referralCode}`;

  const referrals = user.referrals.map((referral) => {
    const deliveredOrder = referral.orders.find((order) => order.status === 'DELIVERED');
    const firstOrder = referral.orders[0];

    const status = deliveredOrder
      ? 'completed'
      : firstOrder
        ? 'made_purchase'
        : 'signed_up';

    const rewardPoints = status === 'signed_up'
      ? LOYALTY_CONFIG.points_for_referral_signup
      : LOYALTY_CONFIG.points_for_referral_signup + LOYALTY_CONFIG.points_for_referral_purchase;

    return {
      id: referral.id,
      referralCode,
      referredEmail: referral.email,
      referredName: [referral.firstName, referral.lastName].filter(Boolean).join(' ') || referral.email,
      status,
      rewardPoints,
      createdAt: referral.createdAt,
      completedAt: deliveredOrder?.deliveredAt ?? deliveredOrder?.createdAt ?? firstOrder?.createdAt,
    };
  });

  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const successfulReferrals = referrals.filter(
    (referral) => referral.status === 'made_purchase' || referral.status === 'completed'
  );

  return {
    referralData: {
      referralCode,
      referralLink,
      totalReferrals: referrals.length,
      successfulReferrals: successfulReferrals.length,
      pendingReferrals: referrals.filter((referral) => referral.status === 'signed_up').length,
      totalEarned: referrals.reduce((sum, referral) => sum + referral.rewardPoints, 0),
      referralStats: {
        thisMonth: referrals.filter((referral) => new Date(referral.createdAt) >= startOfThisMonth).length,
        lastMonth: referrals.filter(
          (referral) =>
            new Date(referral.createdAt) >= startOfLastMonth &&
            new Date(referral.createdAt) < startOfThisMonth
        ).length,
        lifetime: successfulReferrals.length,
      },
      rewards: {
        signupBonus: LOYALTY_CONFIG.points_for_referral_signup,
        purchaseBonus: LOYALTY_CONFIG.points_for_referral_purchase,
        totalPotential: LOYALTY_CONFIG.points_for_referral_signup + LOYALTY_CONFIG.points_for_referral_purchase,
      },
    },
    referrals,
    senderName: [user.firstName, user.lastName].filter(Boolean).join(' ') || 'A friend',
  };
}

export default async function ReferralsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect('/login?redirect=/account/referrals');
  }

  const data = await getReferralsData(session.user.id);
  const personalizedTemplates = emailTemplates.map((template) => ({
    ...template,
    body: template.body.replace('{senderName}', data.senderName),
  }));

  return (
    <ReferralsClient
      referralData={data.referralData}
      referrals={data.referrals}
      shareOptions={shareOptions}
      emailTemplates={personalizedTemplates}
    />
  );
}
