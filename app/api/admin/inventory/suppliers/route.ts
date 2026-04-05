import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import {
  adminUnauthorizedResponse,
  getVerifiedAdmin,
} from '@/app/api/admin/_utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const admin = await getVerifiedAdmin(request);
    if (!admin) {
      return adminUnauthorizedResponse();
    }

    const rows = await prisma.$queryRaw<Array<{
      id: string;
      code: string;
      name: string;
      contactPerson: string | null;
      email: string | null;
      phone: string | null;
      paymentTerms: string | null;
      isActive: boolean;
      productCount: number | null;
    }>>(Prisma.sql`
      SELECT
        s."id",
        s."code",
        s."name",
        s."contactPerson",
        s."email",
        s."phone",
        s."paymentTerms",
        s."isActive",
        COUNT(DISTINCT sp."productId")::int AS "productCount"
      FROM "Supplier" s
      LEFT JOIN "SupplierProduct" sp
        ON sp."supplierId" = s."id"
      GROUP BY s."id", s."code", s."name", s."contactPerson", s."email", s."phone", s."paymentTerms", s."isActive"
      ORDER BY s."isActive" DESC, s."name" ASC
    `);

    return NextResponse.json({ suppliers: rows });
  } catch (error) {
    console.error('Admin suppliers GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch suppliers' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await getVerifiedAdmin(request);
    if (!admin) {
      return adminUnauthorizedResponse();
    }

    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const contactPerson = typeof body.contactPerson === 'string' ? body.contactPerson.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const address = typeof body.address === 'string' ? body.address.trim() : '';
    const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
    const paymentTerms = typeof body.paymentTerms === 'string' ? body.paymentTerms.trim() : '';
    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';

    if (!name) {
      return NextResponse.json({ error: 'Supplier name is required' }, { status: 400 });
    }

    const supplierCode = code || `SUP-${Date.now().toString().slice(-6)}`;
    const existing = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "Supplier"
      WHERE "code" = ${supplierCode}
      LIMIT 1
    `);

    if (existing.length > 0) {
      return NextResponse.json({ error: 'Supplier code already exists' }, { status: 409 });
    }

    const supplierId = randomUUID();
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "Supplier" (
        "id",
        "code",
        "name",
        "contactPerson",
        "email",
        "phone",
        "address",
        "notes",
        "paymentTerms",
        "isActive",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${supplierId},
        ${supplierCode},
        ${name},
        ${contactPerson || null},
        ${email || null},
        ${phone || null},
        ${address || null},
        ${notes || null},
        ${paymentTerms || null},
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `);

    return NextResponse.json({
      success: true,
      supplier: {
        id: supplierId,
        code: supplierCode,
        name,
        contactPerson: contactPerson || null,
        email: email || null,
        phone: phone || null,
        address: address || null,
        notes: notes || null,
        paymentTerms: paymentTerms || null,
        isActive: true,
      },
    });
  } catch (error) {
    console.error('Admin suppliers POST error:', error);
    return NextResponse.json({ error: 'Failed to create supplier' }, { status: 500 });
  }
}
