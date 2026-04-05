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

type PurchaseInsightRow = {
  productId: string;
  shortlisted: boolean | null;
  shortlistNote: string | null;
  shortlistPriority: number | null;
  supplierCount: number | null;
  preferredSupplierName: string | null;
  lastSupplierName: string | null;
  lastPurchaseRate: string | number | null;
  lastPurchaseDate: Date | string | null;
  lowestSupplierName: string | null;
  lowestPurchaseRate: string | number | null;
  lowestPurchaseDate: Date | string | null;
};

type ShortlistRow = {
  shortlistId: string;
  productId: string;
  productName: string;
  sku: string;
  brand: string;
  category: string;
  currentStock: number;
  reorderLevel: number;
  price: string | number;
  costPrice: string | number | null;
  note: string | null;
  priority: number;
  updatedAt: Date | string;
};

type SupplierRow = {
  id: string;
  code: string;
  name: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  paymentTerms: string | null;
  isActive: boolean;
  productCount: number | null;
  purchaseOrderCount: number | null;
  lastOrderAt: Date | string | null;
};

type PurchaseOrderRow = {
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
  updatedAt: Date | string;
  supplierId: string;
  supplierName: string;
  supplierCode: string;
  itemCount: number | null;
  receivedUnits: number | null;
};

function getInventoryStatus(quantity: number, lowStockThreshold: number) {
  if (quantity === 0) return 'out_of_stock';
  if (quantity <= lowStockThreshold) return 'low_stock';
  if (quantity > lowStockThreshold * 10) return 'overstocked';
  return 'in_stock';
}

function toNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function toISOStringSafe(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

async function getPurchaseInsights(productIds: string[]) {
  if (productIds.length === 0) {
    return new Map<string, PurchaseInsightRow>();
  }

  const rows = await prisma.$queryRaw<PurchaseInsightRow[]>(Prisma.sql`
    SELECT
      p."id" AS "productId",
      shortlist."id" IS NOT NULL AS "shortlisted",
      shortlist."note" AS "shortlistNote",
      shortlist."priority" AS "shortlistPriority",
      supplier_stats."supplierCount",
      preferred_supplier."supplierName" AS "preferredSupplierName",
      last_purchase."supplierName" AS "lastSupplierName",
      last_purchase."unitCost" AS "lastPurchaseRate",
      last_purchase."purchaseDate" AS "lastPurchaseDate",
      lowest_purchase."supplierName" AS "lowestSupplierName",
      lowest_purchase."unitCost" AS "lowestPurchaseRate",
      lowest_purchase."purchaseDate" AS "lowestPurchaseDate"
    FROM "Product" p
    LEFT JOIN "InventoryShortlist" shortlist
      ON shortlist."productId" = p."id"
    LEFT JOIN (
      SELECT sp."productId", COUNT(*)::int AS "supplierCount"
      FROM "SupplierProduct" sp
      GROUP BY sp."productId"
    ) supplier_stats
      ON supplier_stats."productId" = p."id"
    LEFT JOIN (
      SELECT DISTINCT ON (sp."productId")
        sp."productId",
        s."name" AS "supplierName"
      FROM "SupplierProduct" sp
      INNER JOIN "Supplier" s
        ON s."id" = sp."supplierId"
      ORDER BY
        sp."productId",
        sp."isPreferred" DESC,
        sp."lastPurchasedAt" DESC NULLS LAST,
        s."name" ASC
    ) preferred_supplier
      ON preferred_supplier."productId" = p."id"
    LEFT JOIN (
      SELECT
        ranked."productId",
        ranked."supplierName",
        ranked."unitCost",
        ranked."purchaseDate"
      FROM (
        SELECT
          poi."productId",
          s."name" AS "supplierName",
          poi."unitCost",
          COALESCE(poi."receivedAt", po."receivedAt", po."orderedAt", poi."createdAt") AS "purchaseDate",
          ROW_NUMBER() OVER (
            PARTITION BY poi."productId"
            ORDER BY COALESCE(poi."receivedAt", po."receivedAt", po."orderedAt", poi."createdAt") DESC, poi."createdAt" DESC
          ) AS row_number
        FROM "PurchaseOrderItem" poi
        INNER JOIN "PurchaseOrder" po
          ON po."id" = poi."purchaseOrderId"
        INNER JOIN "Supplier" s
          ON s."id" = po."supplierId"
        WHERE poi."receivedQuantity" > 0
          AND po."status" IN ('RECEIVED', 'PARTIALLY_RECEIVED')
      ) ranked
      WHERE ranked.row_number = 1
    ) last_purchase
      ON last_purchase."productId" = p."id"
    LEFT JOIN (
      SELECT
        ranked."productId",
        ranked."supplierName",
        ranked."unitCost",
        ranked."purchaseDate"
      FROM (
        SELECT
          poi."productId",
          s."name" AS "supplierName",
          poi."unitCost",
          COALESCE(poi."receivedAt", po."receivedAt", po."orderedAt", poi."createdAt") AS "purchaseDate",
          ROW_NUMBER() OVER (
            PARTITION BY poi."productId"
            ORDER BY poi."unitCost" ASC, COALESCE(poi."receivedAt", po."receivedAt", po."orderedAt", poi."createdAt") ASC
          ) AS row_number
        FROM "PurchaseOrderItem" poi
        INNER JOIN "PurchaseOrder" po
          ON po."id" = poi."purchaseOrderId"
        INNER JOIN "Supplier" s
          ON s."id" = po."supplierId"
        WHERE poi."receivedQuantity" > 0
          AND po."status" IN ('RECEIVED', 'PARTIALLY_RECEIVED')
      ) ranked
      WHERE ranked.row_number = 1
    ) lowest_purchase
      ON lowest_purchase."productId" = p."id"
    WHERE p."id" IN (${Prisma.join(productIds)})
  `);

  return new Map(rows.map((row) => [row.productId, row]));
}

async function getShortlistItems() {
  const rows = await prisma.$queryRaw<ShortlistRow[]>(Prisma.sql`
    SELECT
      shortlist."id" AS "shortlistId",
      shortlist."productId",
      p."name" AS "productName",
      p."sku",
      COALESCE(b."name", 'No brand') AS "brand",
      COALESCE(c."name", 'Uncategorized') AS "category",
      p."quantity" AS "currentStock",
      p."lowStockThreshold" AS "reorderLevel",
      p."price",
      p."costPrice",
      shortlist."note",
      shortlist."priority",
      p."updatedAt"
    FROM "InventoryShortlist" shortlist
    INNER JOIN "Product" p
      ON p."id" = shortlist."productId"
    LEFT JOIN "Brand" b
      ON b."id" = p."brandId"
    LEFT JOIN "Category" c
      ON c."id" = p."categoryId"
    ORDER BY shortlist."priority" DESC, shortlist."updatedAt" DESC
  `);

  return rows.map((row) => ({
    shortlistId: row.shortlistId,
    productId: row.productId,
    productName: row.productName,
    sku: row.sku,
    brand: row.brand,
    category: row.category,
    currentStock: row.currentStock,
    reorderLevel: row.reorderLevel,
    unitPrice: toNumber(row.price) || 0,
    costPrice: toNumber(row.costPrice),
    note: row.note,
    priority: row.priority,
    updatedAt: toISOStringSafe(row.updatedAt),
    status: getInventoryStatus(row.currentStock, row.reorderLevel),
  }));
}

async function getSuppliers() {
  const rows = await prisma.$queryRaw<SupplierRow[]>(Prisma.sql`
    SELECT
      s."id",
      s."code",
      s."name",
      s."contactPerson",
      s."email",
      s."phone",
      s."paymentTerms",
      s."isActive",
      COUNT(DISTINCT sp."productId")::int AS "productCount",
      COUNT(DISTINCT po."id")::int AS "purchaseOrderCount",
      MAX(COALESCE(po."receivedAt", po."orderedAt")) AS "lastOrderAt"
    FROM "Supplier" s
    LEFT JOIN "SupplierProduct" sp
      ON sp."supplierId" = s."id"
    LEFT JOIN "PurchaseOrder" po
      ON po."supplierId" = s."id"
    GROUP BY
      s."id", s."code", s."name", s."contactPerson", s."email", s."phone", s."paymentTerms", s."isActive"
    ORDER BY s."isActive" DESC, s."name" ASC
  `);

  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    contactPerson: row.contactPerson,
    email: row.email,
    phone: row.phone,
    paymentTerms: row.paymentTerms,
    isActive: row.isActive,
    productCount: row.productCount || 0,
    purchaseOrderCount: row.purchaseOrderCount || 0,
    lastOrderAt: toISOStringSafe(row.lastOrderAt),
  }));
}

async function getPurchaseOrders() {
  const rows = await prisma.$queryRaw<PurchaseOrderRow[]>(Prisma.sql`
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
      po."updatedAt",
      s."id" AS "supplierId",
      s."name" AS "supplierName",
      s."code" AS "supplierCode",
      COUNT(poi."id")::int AS "itemCount",
      COALESCE(SUM(poi."receivedQuantity"), 0)::int AS "receivedUnits"
    FROM "PurchaseOrder" po
    INNER JOIN "Supplier" s
      ON s."id" = po."supplierId"
    LEFT JOIN "PurchaseOrderItem" poi
      ON poi."purchaseOrderId" = po."id"
    GROUP BY
      po."id", po."orderNumber", po."status", po."notes", po."subtotal", po."shippingCost",
      po."taxAmount", po."totalAmount", po."orderedAt", po."receivedAt", po."updatedAt",
      s."id", s."name", s."code"
    ORDER BY po."createdAt" DESC
    LIMIT 40
  `);

  return rows.map((row) => ({
    id: row.id,
    orderNumber: row.orderNumber,
    status: row.status,
    notes: row.notes,
    subtotal: toNumber(row.subtotal) || 0,
    shippingCost: toNumber(row.shippingCost) || 0,
    taxAmount: toNumber(row.taxAmount) || 0,
    totalAmount: toNumber(row.totalAmount) || 0,
    orderedAt: toISOStringSafe(row.orderedAt),
    receivedAt: toISOStringSafe(row.receivedAt),
    updatedAt: toISOStringSafe(row.updatedAt),
    supplier: {
      id: row.supplierId,
      name: row.supplierName,
      code: row.supplierCode,
    },
    itemCount: row.itemCount || 0,
    receivedUnits: row.receivedUnits || 0,
  }));
}

export async function GET(request: NextRequest) {
  try {
    const admin = await getVerifiedAdmin(request);
    if (!admin) {
      return adminUnauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || 'all';
    const category = searchParams.get('category') || 'all';
    const sort = searchParams.get('sort') || 'stock';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { brand: { name: { contains: search, mode: 'insensitive' } } },
        { category: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (category !== 'all') {
      where.category = {
        name: { equals: category, mode: 'insensitive' },
      };
    }

    if (status === 'out_of_stock') {
      where.quantity = 0;
    } else if (status === 'low_stock') {
      where.quantity = { gt: 0 };
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        category: true,
        brand: true,
      },
      orderBy:
        sort === 'name'
          ? { name: 'asc' }
          : sort === 'value'
            ? { price: 'desc' }
            : sort === 'updated'
              ? { updatedAt: 'desc' }
              : { quantity: sort === 'lowStock' ? 'asc' : 'desc' },
    });

    const productIds = products.map((product) => product.id);
    const [insightMap, shortlist, suppliers, purchaseOrders] = await Promise.all([
      getPurchaseInsights(productIds),
      getShortlistItems(),
      getSuppliers(),
      getPurchaseOrders(),
    ]);

    let inventoryItems = products.map((product) => {
      const itemStatus = getInventoryStatus(product.quantity, product.lowStockThreshold);
      const maxStock = Math.max(product.lowStockThreshold * 10, product.quantity);
      const unitPrice = product.price.toNumber();
      const costPrice = product.costPrice ? product.costPrice.toNumber() : null;
      const totalValue = product.quantity * unitPrice;
      const marginPercent =
        costPrice && unitPrice > 0
          ? Math.round(((unitPrice - costPrice) / unitPrice) * 100)
          : null;
      const insight = insightMap.get(product.id);

      return {
        id: product.id,
        productName: product.name,
        sku: product.sku,
        brand: product.brand?.name || 'No brand',
        category: product.category?.name || 'Uncategorized',
        currentStock: product.quantity,
        reorderLevel: product.lowStockThreshold,
        maxStock,
        unitPrice,
        costPrice,
        marginPercent,
        totalValue,
        status: itemStatus,
        isActive: product.isActive,
        trackInventory: product.trackInventory,
        allowBackorder: product.allowBackorder,
        updatedAt: product.updatedAt.toISOString(),
        shortlisted: Boolean(insight?.shortlisted),
        shortlistNote: insight?.shortlistNote || null,
        shortlistPriority: insight?.shortlistPriority || 0,
        supplierCount: insight?.supplierCount || 0,
        preferredSupplierName: insight?.preferredSupplierName || null,
        lastSupplierName: insight?.lastSupplierName || null,
        lastPurchaseRate: toNumber(insight?.lastPurchaseRate),
        lastPurchaseDate: toISOStringSafe(insight?.lastPurchaseDate),
        lowestSupplierName: insight?.lowestSupplierName || null,
        lowestPurchaseRate: toNumber(insight?.lowestPurchaseRate),
        lowestPurchaseDate: toISOStringSafe(insight?.lowestPurchaseDate),
      };
    });

    if (status !== 'all' && status !== 'out_of_stock') {
      inventoryItems = inventoryItems.filter((item) => item.status === status);
    }

    const totalValue = inventoryItems.reduce((sum, item) => sum + item.totalValue, 0);
    const lowStockCount = inventoryItems.filter((item) => item.status === 'low_stock').length;
    const outOfStockCount = inventoryItems.filter((item) => item.status === 'out_of_stock').length;
    const overstockedCount = inventoryItems.filter((item) => item.status === 'overstocked').length;
    const categories = [...new Set(inventoryItems.map((item) => item.category))].sort();

    return NextResponse.json({
      inventory: inventoryItems,
      shortlist,
      suppliers,
      purchaseOrders,
      categories,
      stats: {
        totalValue,
        totalProducts: inventoryItems.length,
        lowStockCount,
        outOfStockCount,
        overstockedCount,
        shortlistCount: shortlist.length,
      },
    });
  } catch (error) {
    console.error('Admin inventory GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch inventory workspace' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await getVerifiedAdmin(request);
    if (!admin) {
      return adminUnauthorizedResponse();
    }

    const body = await request.json();
    const ids = Array.isArray(body.ids)
      ? (body.ids as unknown[]).filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
      : [];
    const action = typeof body.action === 'string' ? body.action : '';

    if (!ids.length) {
      return NextResponse.json({ error: 'At least one inventory id is required' }, { status: 400 });
    }

    if (!['add', 'remove', 'set', 'reorder'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const products = await prisma.product.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        quantity: true,
        lowStockThreshold: true,
      },
    });

    if (!products.length) {
      return NextResponse.json({ error: 'No inventory items found' }, { status: 404 });
    }

    const amount =
      action === 'reorder'
        ? parseNonNegativeInt(body.reorderLevel, -1)
        : action === 'set'
          ? parseNonNegativeInt(body.quantity, -1)
          : parseNonNegativeInt(body.amount, -1);

    if (amount < 0) {
      return NextResponse.json({ error: 'Invalid quantity' }, { status: 400 });
    }

    await prisma.$transaction(
      products.map((product) => {
        if (action === 'reorder') {
          return prisma.product.update({
            where: { id: product.id },
            data: { lowStockThreshold: amount },
          });
        }

        const nextQuantity =
          action === 'add'
            ? product.quantity + amount
            : action === 'remove'
              ? Math.max(0, product.quantity - amount)
              : amount;

        return prisma.product.update({
          where: { id: product.id },
          data: { quantity: nextQuantity },
        });
      })
    );

    return NextResponse.json({
      success: true,
      updatedCount: products.length,
      action,
      ids: products.map((product) => product.id),
    });
  } catch (error) {
    console.error('Admin inventory PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update inventory' }, { status: 500 });
  }
}
