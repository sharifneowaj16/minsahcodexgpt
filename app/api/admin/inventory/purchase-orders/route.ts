import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import {
  adminUnauthorizedResponse,
  getVerifiedAdmin,
  parseMoney,
  parseNonNegativeInt,
} from '@/app/api/admin/_utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PurchaseOrderItemInput = {
  productId?: unknown;
  quantity?: unknown;
  unitCost?: unknown;
  notes?: unknown;
};

function buildOrderNumber() {
  const now = new Date();
  const datePart = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`;
  return `PO-${datePart}-${Math.floor(Math.random() * 9000) + 1000}`;
}

export async function GET(request: NextRequest) {
  try {
    const admin = await getVerifiedAdmin(request);
    if (!admin) {
      return adminUnauthorizedResponse();
    }

    const rows = await prisma.$queryRaw<Array<{
      id: string;
      orderNumber: string;
      status: string;
      notes: string | null;
      subtotal: string | number;
      shippingCost: string | number;
      taxAmount: string | number;
      totalAmount: string | number;
      orderedAt: Date | string;
      receivedAt: Date | string | null;
      supplierId: string;
      supplierName: string;
      itemCount: number | null;
    }>>(Prisma.sql`
      SELECT
        po."id",
        po."orderNumber",
        po."status",
        po."notes",
        po."subtotal",
        po."shippingCost",
        po."taxAmount",
        po."totalAmount",
        po."orderedAt",
        po."receivedAt",
        s."id" AS "supplierId",
        s."name" AS "supplierName",
        COUNT(poi."id")::int AS "itemCount"
      FROM "PurchaseOrder" po
      INNER JOIN "Supplier" s
        ON s."id" = po."supplierId"
      LEFT JOIN "PurchaseOrderItem" poi
        ON poi."purchaseOrderId" = po."id"
      GROUP BY po."id", s."id", s."name"
      ORDER BY po."createdAt" DESC
      LIMIT 50
    `);

    return NextResponse.json({ purchaseOrders: rows });
  } catch (error) {
    console.error('Purchase orders GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch purchase orders' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await getVerifiedAdmin(request);
    if (!admin) {
      return adminUnauthorizedResponse();
    }

    const body = await request.json();
    const supplierId = typeof body.supplierId === 'string' ? body.supplierId.trim() : '';
    const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
    const shippingCost = parseMoney(body.shippingCost ?? 0, 'shipping cost');
    const taxAmount = parseMoney(body.taxAmount ?? 0, 'tax amount');
    const items: PurchaseOrderItemInput[] = Array.isArray(body.items) ? body.items : [];

    if (!supplierId) {
      return NextResponse.json({ error: 'supplierId is required' }, { status: 400 });
    }

    if (!items.length) {
      return NextResponse.json({ error: 'At least one purchase item is required' }, { status: 400 });
    }

    const supplier = await prisma.$queryRaw<Array<{ id: string; name: string }>>(Prisma.sql`
      SELECT "id", "name"
      FROM "Supplier"
      WHERE "id" = ${supplierId}
      LIMIT 1
    `);

    if (!supplier.length) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    const normalizedItems = items.map((item) => ({
      productId: typeof item.productId === 'string' ? item.productId.trim() : '',
      quantity: parseNonNegativeInt(item.quantity, -1),
      unitCost: parseMoney(item.unitCost, 'unit cost'),
      notes: typeof item.notes === 'string' ? item.notes.trim() : '',
    }));

    if (normalizedItems.some((item) => !item.productId || item.quantity <= 0)) {
      return NextResponse.json({ error: 'Each item needs productId, quantity, and unitCost' }, { status: 400 });
    }

    const products = await prisma.product.findMany({
      where: { id: { in: normalizedItems.map((item) => item.productId) } },
      select: {
        id: true,
        name: true,
        sku: true,
      },
    });

    if (products.length !== normalizedItems.length) {
      return NextResponse.json({ error: 'One or more products were not found' }, { status: 404 });
    }

    const subtotal = normalizedItems.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0);
    const totalAmount = subtotal + shippingCost + taxAmount;
    const orderId = randomUUID();
    const orderNumber = buildOrderNumber();

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "PurchaseOrder" (
          "id",
          "orderNumber",
          "supplierId",
          "status",
          "notes",
          "subtotal",
          "shippingCost",
          "taxAmount",
          "totalAmount",
          "orderedAt",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${orderId},
          ${orderNumber},
          ${supplierId},
          'DRAFT',
          ${notes || null},
          ${subtotal},
          ${shippingCost},
          ${taxAmount},
          ${totalAmount},
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
      `);

      for (const item of normalizedItems) {
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO "PurchaseOrderItem" (
            "id",
            "purchaseOrderId",
            "productId",
            "quantity",
            "receivedQuantity",
            "unitCost",
            "notes",
            "createdAt",
            "updatedAt"
          )
          VALUES (
            ${randomUUID()},
            ${orderId},
            ${item.productId},
            ${item.quantity},
            0,
            ${item.unitCost},
            ${item.notes || null},
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
        `);

        await tx.$executeRaw(Prisma.sql`
          INSERT INTO "SupplierProduct" (
            "id",
            "supplierId",
            "productId",
            "isPreferred",
            "createdAt",
            "updatedAt"
          )
          VALUES (
            ${randomUUID()},
            ${supplierId},
            ${item.productId},
            false,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
          ON CONFLICT ("supplierId", "productId")
          DO UPDATE SET "updatedAt" = CURRENT_TIMESTAMP
        `);
      }
    });

    return NextResponse.json({
      success: true,
      purchaseOrder: {
        id: orderId,
        orderNumber,
        supplierId,
        subtotal,
        shippingCost,
        taxAmount,
        totalAmount,
        itemCount: normalizedItems.length,
      },
    });
  } catch (error) {
    console.error('Purchase orders POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create purchase order' },
      { status: 500 }
    );
  }
}
