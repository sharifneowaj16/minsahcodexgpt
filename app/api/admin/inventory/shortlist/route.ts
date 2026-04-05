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

type ExistingShortlistRow = {
  id: string;
  productId: string;
  note: string | null;
  priority: number;
};

export async function POST(request: NextRequest) {
  try {
    const admin = await getVerifiedAdmin(request);
    if (!admin) {
      return adminUnauthorizedResponse();
    }

    const body = await request.json();
    const productId = typeof body.productId === 'string' ? body.productId.trim() : '';
    const action = typeof body.action === 'string' ? body.action.trim().toLowerCase() : 'toggle';
    const note = typeof body.note === 'string' ? body.note.trim() : '';
    const priority = parseNonNegativeInt(body.priority, 0);

    if (!productId) {
      return NextResponse.json({ error: 'productId is required' }, { status: 400 });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const existing = await prisma.$queryRaw<ExistingShortlistRow[]>(Prisma.sql`
      SELECT "id", "productId", "note", "priority"
      FROM "InventoryShortlist"
      WHERE "productId" = ${productId}
      LIMIT 1
    `);

    const current = existing[0];
    const shouldRemove = action === 'remove' || (action === 'toggle' && current);

    if (shouldRemove && current) {
      await prisma.$executeRaw(Prisma.sql`
        DELETE FROM "InventoryShortlist"
        WHERE "id" = ${current.id}
      `);

      return NextResponse.json({
        success: true,
        action: 'removed',
        productId,
      });
    }

    if (current) {
      await prisma.$executeRaw(Prisma.sql`
        UPDATE "InventoryShortlist"
        SET
          "note" = ${note || current.note},
          "priority" = ${priority},
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${current.id}
      `);

      return NextResponse.json({
        success: true,
        action: 'updated',
        productId,
        note: note || current.note,
        priority,
      });
    }

    const shortlistId = randomUUID();
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "InventoryShortlist" (
        "id",
        "adminId",
        "productId",
        "note",
        "priority",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${shortlistId},
        ${admin.adminId},
        ${productId},
        ${note || null},
        ${priority},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `);

    return NextResponse.json({
      success: true,
      action: 'added',
      productId,
      note: note || null,
      priority,
    });
  } catch (error) {
    console.error('Admin inventory shortlist POST error:', error);
    return NextResponse.json({ error: 'Failed to update shortlist' }, { status: 500 });
  }
}
