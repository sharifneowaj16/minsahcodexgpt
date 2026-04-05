import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import {
  adminUnauthorizedResponse,
  getVerifiedAdmin,
  parseNonNegativeInt,
} from '@/app/api/admin/_utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type OrderItemRow = {
  id: string;
  productId: string;
  quantity: number;
  receivedQuantity: number;
  unitCost: string | number;
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getVerifiedAdmin(request);
    if (!admin) {
      return adminUnauthorizedResponse();
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const requestedItems = Array.isArray(body.items) ? body.items : [];

    const purchaseOrders = await prisma.$queryRaw<Array<{
      id: string;
      supplierId: string;
      status: string;
    }>>(Prisma.sql`
      SELECT "id", "supplierId", "status"
      FROM "PurchaseOrder"
      WHERE "id" = ${id}
      LIMIT 1
    `);

    const purchaseOrder = purchaseOrders[0];
    if (!purchaseOrder) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    const orderItems = await prisma.$queryRaw<OrderItemRow[]>(Prisma.sql`
      SELECT
        "id",
        "productId",
        "quantity",
        "receivedQuantity",
        "unitCost"
      FROM "PurchaseOrderItem"
      WHERE "purchaseOrderId" = ${id}
      ORDER BY "createdAt" ASC
    `);

    if (!orderItems.length) {
      return NextResponse.json({ error: 'Purchase order has no items' }, { status: 400 });
    }

    const receiveMap = new Map<string, number>();
    if (requestedItems.length > 0) {
      for (const item of requestedItems) {
        const itemId = typeof item.purchaseOrderItemId === 'string' ? item.purchaseOrderItemId.trim() : '';
        const receivedQuantity = parseNonNegativeInt(item.receivedQuantity, -1);
        if (itemId && receivedQuantity >= 0) {
          receiveMap.set(itemId, receivedQuantity);
        }
      }
    }

    const normalizedReceipts = orderItems
      .map((item) => {
        const remaining = item.quantity - item.receivedQuantity;
        const requested = receiveMap.has(item.id) ? receiveMap.get(item.id)! : remaining;
        return {
          ...item,
          receiveNow: Math.min(remaining, Math.max(0, requested)),
          unitCostNumber: Number(item.unitCost),
        };
      })
      .filter((item) => item.receiveNow > 0);

    if (!normalizedReceipts.length) {
      return NextResponse.json({ error: 'No receivable quantity found for this order' }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      for (const item of normalizedReceipts) {
        await tx.$executeRaw(Prisma.sql`
          UPDATE "PurchaseOrderItem"
          SET
            "receivedQuantity" = "receivedQuantity" + ${item.receiveNow},
            "receivedAt" = CURRENT_TIMESTAMP,
            "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = ${item.id}
        `);

        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: {
            id: true,
            quantity: true,
          },
        });

        if (product) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              quantity: product.quantity + item.receiveNow,
              costPrice: item.unitCostNumber,
            },
          });
        }

        await tx.$executeRaw(Prisma.sql`
          INSERT INTO "SupplierProduct" (
            "id",
            "supplierId",
            "productId",
            "lastPurchaseRate",
            "lowestPurchaseRate",
            "lowestPurchaseRateDate",
            "lastPurchasedAt",
            "isPreferred",
            "createdAt",
            "updatedAt"
          )
          VALUES (
            ${randomUUID()},
            ${purchaseOrder.supplierId},
            ${item.productId},
            ${item.unitCostNumber},
            ${item.unitCostNumber},
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP,
            true,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
          ON CONFLICT ("supplierId", "productId")
          DO UPDATE SET
            "lastPurchaseRate" = EXCLUDED."lastPurchaseRate",
            "lastPurchasedAt" = CURRENT_TIMESTAMP,
            "isPreferred" = true,
            "lowestPurchaseRate" = CASE
              WHEN "SupplierProduct"."lowestPurchaseRate" IS NULL THEN EXCLUDED."lowestPurchaseRate"
              WHEN EXCLUDED."lowestPurchaseRate" < "SupplierProduct"."lowestPurchaseRate" THEN EXCLUDED."lowestPurchaseRate"
              ELSE "SupplierProduct"."lowestPurchaseRate"
            END,
            "lowestPurchaseRateDate" = CASE
              WHEN "SupplierProduct"."lowestPurchaseRate" IS NULL THEN CURRENT_TIMESTAMP
              WHEN EXCLUDED."lowestPurchaseRate" < "SupplierProduct"."lowestPurchaseRate" THEN CURRENT_TIMESTAMP
              ELSE "SupplierProduct"."lowestPurchaseRateDate"
            END,
            "updatedAt" = CURRENT_TIMESTAMP
        `);
      }

      const updatedItems = await tx.$queryRaw<Array<{ quantity: number; receivedQuantity: number }>>(Prisma.sql`
        SELECT "quantity", "receivedQuantity"
        FROM "PurchaseOrderItem"
        WHERE "purchaseOrderId" = ${id}
      `);

      const fullyReceived = updatedItems.every((item) => item.receivedQuantity >= item.quantity);
      await tx.$executeRaw(Prisma.sql`
        UPDATE "PurchaseOrder"
        SET
          "status" = ${fullyReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED'},
          "receivedAt" = CURRENT_TIMESTAMP,
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${id}
      `);
    });

    return NextResponse.json({
      success: true,
      purchaseOrderId: id,
      receivedItems: normalizedReceipts.length,
      receivedUnits: normalizedReceipts.reduce((sum, item) => sum + item.receiveNow, 0),
    });
  } catch (error) {
    console.error('Purchase order receive POST error:', error);
    return NextResponse.json({ error: 'Failed to receive purchase order' }, { status: 500 });
  }
}
