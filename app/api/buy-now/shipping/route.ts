import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  estimateDeliveryCharge,
  extractVariantWeightKg,
  fetchSteadfastDeliveryQuote,
  parseWeightToKg,
  resolvePackagingWeightKg,
} from '@/lib/buy-now';

export const dynamic = 'force-dynamic';

interface ShippingRequestItem {
  productId: string;
  variantId?: string | null;
  quantity: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      items?: ShippingRequestItem[];
      city?: string;
      area?: string;
    };

    const items = body.items ?? [];
    const city = body.city?.trim() ?? '';
    const area = body.area?.trim() ?? '';

    if (!items.length) {
      return NextResponse.json({ error: 'At least one item is required' }, { status: 400 });
    }

    if (!city || !area) {
      return NextResponse.json({ error: 'City and area are required' }, { status: 400 });
    }

    const productIds = [...new Set(items.map((item) => item.productId))];
    const variantIds = [...new Set(items.map((item) => item.variantId).filter(Boolean))] as string[];

    const [products, variants, configs] = await Promise.all([
      prisma.product.findMany({
        where: { id: { in: productIds }, isActive: true },
        select: {
          id: true,
          name: true,
          weight: true,
          shippingWeight: true,
        },
      }),
      variantIds.length
        ? prisma.productVariant.findMany({
            where: { id: { in: variantIds } },
            select: {
              id: true,
              productId: true,
              name: true,
              attributes: true,
            },
          })
        : Promise.resolve([]),
      prisma.siteConfig.findMany({
        where: {
          key: {
            in: ['packagingWeight', 'shippingSettings', 'deliverySettings', 'orderPackagingWeight'],
          },
        },
        select: { value: true },
      }),
    ]);

    const productMap = new Map(products.map((product) => [product.id, product]));
    const variantMap = new Map(variants.map((variant) => [variant.id, variant]));

    const normalizedItems = items.map((item) => {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new Error(`PRODUCT_NOT_FOUND:${item.productId}`);
      }

      const variant = item.variantId ? variantMap.get(item.variantId) : null;
      const variantWeightKg = variant ? extractVariantWeightKg(variant.attributes) : null;
      const productWeightKg =
        parseWeightToKg(product.weight?.toNumber?.() ?? product.weight) ??
        parseWeightToKg(product.shippingWeight);
      const unitWeightKg = variantWeightKg ?? productWeightKg ?? 0.1;
      const quantity = Math.max(1, Math.trunc(item.quantity || 1));

      return {
        productId: item.productId,
        variantId: item.variantId ?? null,
        quantity,
        unitWeightKg,
      };
    });

    const itemsWeightKg = normalizedItems.reduce(
      (sum, item) => sum + item.unitWeightKg * item.quantity,
      0
    );
    const packagingWeightKg = resolvePackagingWeightKg(configs.map((config) => config.value));
    const parcelWeightKg = Number((itemsWeightKg + packagingWeightKg).toFixed(3));

    let quote;
    try {
      quote =
        (await fetchSteadfastDeliveryQuote({
          city,
          area,
          parcelWeightKg,
        })) ??
        estimateDeliveryCharge({ city, area, parcelWeightKg });
    } catch (error) {
      console.error('Buy now delivery quote failed, using fallback estimate:', error);
      quote = estimateDeliveryCharge({ city, area, parcelWeightKg });
    }

    return NextResponse.json({
      deliveryCharge: quote.charge,
      quoteSource: quote.source,
      message: quote.note ?? null,
      weights: {
        itemsWeightKg: Number(itemsWeightKg.toFixed(3)),
        packagingWeightKg: Number(packagingWeightKg.toFixed(3)),
        parcelWeightKg,
      },
    });
  } catch (error) {
    console.error('POST /api/buy-now/shipping error:', error);

    if (error instanceof Error && error.message.startsWith('PRODUCT_NOT_FOUND:')) {
      return NextResponse.json({ error: 'One or more selected items are unavailable' }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Failed to calculate delivery charge' },
      { status: 500 }
    );
  }
}
