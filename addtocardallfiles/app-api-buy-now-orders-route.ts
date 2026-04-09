import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthenticatedUserId } from '@/app/api/auth/_utils';
import {
  extractVariantWeightKg,
  parseWeightToKg,
  resolvePackagingWeightKg,
} from '@/lib/buy-now';

export const dynamic = 'force-dynamic';

interface BuyNowItemInput {
  productId: string;
  variantId?: string | null;
  quantity: number;
}

interface BuyNowAddressInput {
  name: string;
  phone: string;
  address: string;
  city: string;
  area: string;
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request);

    if (!userId) {
      return NextResponse.json(
        { error: 'Please log in to place this order.', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    const body = (await request.json()) as {
      items?: BuyNowItemInput[];
      shippingAddress?: BuyNowAddressInput;
      deliveryCharge?: number;
      subtotal?: number;
      grandTotal?: number;
      parcelWeight?: number;
      paymentMethod?: string;
      deliveryPendingConfirmation?: boolean;
    };

    const items = body.items ?? [];
    const shippingAddress = body.shippingAddress;
    const paymentMethod = body.paymentMethod?.trim() || 'COD';
    const deliveryCharge = Math.max(0, Number(body.deliveryCharge ?? 0));
    const deliveryPendingConfirmation = Boolean(body.deliveryPendingConfirmation);

    if (!items.length) {
      return NextResponse.json({ error: 'No items selected' }, { status: 400 });
    }

    if (
      !shippingAddress?.name?.trim() ||
      !shippingAddress.phone?.trim() ||
      !shippingAddress.address?.trim() ||
      !shippingAddress.city?.trim() ||
      !shippingAddress.area?.trim()
    ) {
      return NextResponse.json({ error: 'Shipping address is incomplete' }, { status: 400 });
    }

    const productIds = [...new Set(items.map((item) => item.productId))];
    const variantIds = [...new Set(items.map((item) => item.variantId).filter(Boolean))] as string[];

    const [products, variants, configs] = await Promise.all([
      prisma.product.findMany({
        where: { id: { in: productIds }, isActive: true },
        select: {
          id: true,
          name: true,
          sku: true,
          price: true,
          quantity: true,
          trackInventory: true,
          allowBackorder: true,
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
              sku: true,
              price: true,
              quantity: true,
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
    const packagingWeightKg = resolvePackagingWeightKg(configs.map((config) => config.value));

    const orderItems = items.map((item) => {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new Error(`PRODUCT_NOT_FOUND:${item.productId}`);
      }

      const quantity = Math.max(1, Math.trunc(item.quantity || 1));
      const variant = item.variantId ? variantMap.get(item.variantId) : null;

      if (item.variantId && (!variant || variant.productId !== item.productId)) {
        throw new Error(`VARIANT_NOT_FOUND:${item.variantId}`);
      }

      const availableStock = variant ? variant.quantity : product.quantity;
      if (product.trackInventory && !product.allowBackorder && availableStock < quantity) {
        throw new Error(`INSUFFICIENT_STOCK:${product.id}`);
      }

      const unitPrice = Number((variant?.price ?? product.price).toString());
      const unitWeightKg =
        extractVariantWeightKg(variant?.attributes) ??
        parseWeightToKg(product.weight?.toNumber?.() ?? product.weight) ??
        parseWeightToKg(product.shippingWeight) ??
        0.1;
      const variantLabel = variant
        ? (() => {
            const attributes = variant.attributes as Record<string, unknown> | null;
            const parts = [
              typeof attributes?.size === 'string' ? attributes.size : null,
              typeof attributes?.color === 'string' ? attributes.color : null,
            ].filter(Boolean);

            return parts.length > 0 ? parts.join(' / ') : variant.name;
          })()
        : null;

      return {
        productId: product.id,
        productName: product.name,
        variantId: variant?.id ?? null,
        variantLabel,
        sku: variant?.sku ?? product.sku,
        price: unitPrice,
        quantity,
        total: Number((unitPrice * quantity).toFixed(2)),
        unitWeightKg,
      };
    });

    const subtotal = Number(
      orderItems.reduce((sum, item) => sum + item.total, 0).toFixed(2)
    );
    const itemsWeightKg = Number(
      orderItems.reduce((sum, item) => sum + item.unitWeightKg * item.quantity, 0).toFixed(3)
    );
    const parcelWeightKg = Number((itemsWeightKg + packagingWeightKg).toFixed(3));
    const total = Number((subtotal + deliveryCharge).toFixed(2));
    const computedSubtotal = Number(body.subtotal ?? 0);
    const computedGrandTotal = Number(body.grandTotal ?? 0);

    const order = await prisma.$transaction(async (tx) => {
      const addressRecord = await tx.address.create({
        data: {
          userId,
          firstName: shippingAddress.name.trim(),
          lastName: '',
          phone: shippingAddress.phone.trim(),
          street1: shippingAddress.address.trim(),
          street2: shippingAddress.area.trim(),
          city: shippingAddress.city.trim(),
          state: shippingAddress.area.trim(),
          postalCode: '',
          country: 'Bangladesh',
          isDefault: false,
          type: 'SHIPPING',
        },
      });

      const orderNumber = `MNS-${Date.now().toString().slice(-8)}`;
      const customerNoteParts = [
        'Placed with Buy Now flow',
        `Parcel weight: ${parcelWeightKg.toFixed(3)}kg`,
        deliveryPendingConfirmation ? 'Delivery charge pending courier confirmation' : null,
        computedSubtotal && Math.abs(computedSubtotal - subtotal) > 0.01
          ? `Client subtotal mismatch: ${computedSubtotal}`
          : null,
        computedGrandTotal && Math.abs(computedGrandTotal - total) > 0.01
          ? `Client total mismatch: ${computedGrandTotal}`
          : null,
      ].filter(Boolean);

      const createdOrder = await tx.order.create({
        data: {
          orderNumber,
          userId,
          addressId: addressRecord.id,
          status: 'PENDING',
          paymentStatus: 'PENDING',
          paymentMethod,
          subtotal,
          shippingCost: deliveryCharge,
          taxAmount: 0,
          discountAmount: 0,
          total,
          customerNote: customerNoteParts.join(' | '),
          items: {
            create: orderItems.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              name: item.variantLabel ? `${item.productName} - ${item.variantLabel}` : item.productName,
              sku: item.sku,
              price: item.price,
              quantity: item.quantity,
              total: item.total,
            })),
          },
        },
      });

      for (const item of orderItems) {
        if (item.variantId) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { quantity: { decrement: item.quantity } },
          });
        } else {
          const product = productMap.get(item.productId);
          if (product?.trackInventory) {
            await tx.product.update({
              where: { id: item.productId },
              data: { quantity: { decrement: item.quantity } },
            });
          }
        }
      }

      return createdOrder;
    });

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
      subtotal,
      deliveryCharge,
      grandTotal: total,
      parcelWeightKg,
      estimatedDelivery: shippingAddress.city.toLowerCase().includes('dhaka') ? '1-2 days' : '2-3 days',
    });
  } catch (error) {
    console.error('POST /api/buy-now/orders error:', error);

    if (error instanceof Error) {
      if (error.message.startsWith('PRODUCT_NOT_FOUND:') || error.message.startsWith('VARIANT_NOT_FOUND:')) {
        return NextResponse.json({ error: 'One or more selected items are unavailable' }, { status: 400 });
      }

      if (error.message.startsWith('INSUFFICIENT_STOCK:')) {
        return NextResponse.json({ error: 'Some selected quantity is no longer available' }, { status: 409 });
      }
    }

    return NextResponse.json(
      { error: 'Failed to place buy now order. Please try again.' },
      { status: 500 }
    );
  }
}
