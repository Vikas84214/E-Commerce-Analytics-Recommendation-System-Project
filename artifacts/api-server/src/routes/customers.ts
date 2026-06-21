import { Router, type IRouter } from "express";
import { db, usersTable, ordersTable, orderItemsTable, productsTable } from "@workspace/db";
import { eq, sql, desc, ilike, and } from "drizzle-orm";
import { GetCustomerParams, ListCustomersQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

function computeRFMSegment(recencyDays: number, frequency: number, monetary: number): string {
  let r = recencyDays <= 30 ? 5 : recencyDays <= 60 ? 4 : recencyDays <= 90 ? 3 : recencyDays <= 180 ? 2 : 1;
  let f = frequency >= 10 ? 5 : frequency >= 6 ? 4 : frequency >= 4 ? 3 : frequency >= 2 ? 2 : 1;
  let m = monetary >= 2000 ? 5 : monetary >= 1000 ? 4 : monetary >= 500 ? 3 : monetary >= 200 ? 2 : 1;
  const score = r + f + m;
  if (score >= 13) return "Champions";
  if (score >= 10) return "Loyal";
  if (score >= 7) return "Potential";
  if (score >= 5) return "At Risk";
  return "Lost";
}

function computeRFMScores(recencyDays: number, frequency: number, monetary: number) {
  return {
    recency: recencyDays <= 30 ? 5 : recencyDays <= 60 ? 4 : recencyDays <= 90 ? 3 : recencyDays <= 180 ? 2 : 1,
    frequency: frequency >= 10 ? 5 : frequency >= 6 ? 4 : frequency >= 4 ? 3 : frequency >= 2 ? 2 : 1,
    monetary: monetary >= 2000 ? 5 : monetary >= 1000 ? 4 : monetary >= 500 ? 3 : monetary >= 200 ? 2 : 1,
    total: 0,
  };
}

router.get("/customers/segments", async (_req, res): Promise<void> => {
  const stats = await db
    .select({
      userId: usersTable.id,
      totalOrders: sql<number>`COUNT(${ordersTable.id})`,
      totalSpent: sql<number>`COALESCE(SUM(${ordersTable.totalAmount}), 0)`,
      lastOrderDate: sql<Date | null>`MAX(${ordersTable.orderDate})`,
    })
    .from(usersTable)
    .leftJoin(ordersTable, eq(ordersTable.userId, usersTable.id))
    .where(eq(usersTable.role, "customer"))
    .groupBy(usersTable.id);

  const segmentCounts: Record<string, { count: number; clvSum: number; aovSum: number }> = {};

  for (const s of stats) {
    const recencyDays = s.lastOrderDate
      ? Math.floor((Date.now() - new Date(s.lastOrderDate).getTime()) / 86400000)
      : 999;
    const segment = computeRFMSegment(recencyDays, Number(s.totalOrders), Number(s.totalSpent));
    const avgOrderValue = Number(s.totalOrders) > 0 ? Number(s.totalSpent) / Number(s.totalOrders) : 0;
    const clv = avgOrderValue * Number(s.totalOrders) * 12;

    if (!segmentCounts[segment]) segmentCounts[segment] = { count: 0, clvSum: 0, aovSum: 0 };
    segmentCounts[segment].count++;
    segmentCounts[segment].clvSum += clv;
    segmentCounts[segment].aovSum += avgOrderValue;
  }

  const total = stats.length || 1;
  const segments = Object.entries(segmentCounts).map(([segment, data]) => ({
    segment,
    count: data.count,
    avgClv: data.count > 0 ? Math.round(data.clvSum / data.count) : 0,
    avgOrderValue: data.count > 0 ? Math.round(data.aovSum / data.count * 100) / 100 : 0,
    percentage: Math.round((data.count / total) * 100 * 10) / 10,
  }));

  res.json(segments);
});

router.get("/customers/retention", async (_req, res): Promise<void> => {
  const stats = await db
    .select({
      userId: ordersTable.userId,
      orderCount: sql<number>`COUNT(${ordersTable.id})`,
      lastOrder: sql<Date | null>`MAX(${ordersTable.orderDate})`,
    })
    .from(ordersTable)
    .groupBy(ordersTable.userId);

  const totalCustomers = stats.length || 1;
  const repeatCustomers = stats.filter(s => Number(s.orderCount) > 1).length;
  const activeCustomers = stats.filter(s => {
    if (!s.lastOrder) return false;
    return (Date.now() - new Date(s.lastOrder).getTime()) < 90 * 86400000;
  }).length;

  const avgFrequency = stats.reduce((sum, s) => sum + Number(s.orderCount), 0) / totalCustomers;

  res.json({
    retentionRate: Math.round((activeCustomers / totalCustomers) * 100 * 10) / 10,
    churnRate: Math.round(((totalCustomers - activeCustomers) / totalCustomers) * 100 * 10) / 10,
    avgPurchaseFrequency: Math.round(avgFrequency * 10) / 10,
    avgDaysBetweenOrders: Math.round((365 / (avgFrequency || 1)) * 10) / 10,
    repeatCustomerRate: Math.round((repeatCustomers / totalCustomers) * 100 * 10) / 10,
  });
});

router.get("/customers", async (req, res): Promise<void> => {
  const params = ListCustomersQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { search, page = 1, limit = 20 } = params.data;
  const offset = (page - 1) * limit;

  const conditions = [eq(usersTable.role, "customer")];
  if (search) conditions.push(ilike(usersTable.name, `%${search}%`));

  const [rawCustomers, countResult] = await Promise.all([
    db.select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      createdAt: usersTable.createdAt,
      totalOrders: sql<number>`COUNT(${ordersTable.id})`,
      totalSpent: sql<number>`COALESCE(SUM(${ordersTable.totalAmount}), 0)`,
      lastOrderDate: sql<Date | null>`MAX(${ordersTable.orderDate})`,
    })
      .from(usersTable)
      .leftJoin(ordersTable, eq(ordersTable.userId, usersTable.id))
      .where(and(...conditions))
      .groupBy(usersTable.id)
      .orderBy(desc(sql`total_spent`))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`COUNT(*)` }).from(usersTable).where(and(...conditions)),
  ]);

  const customers = rawCustomers.map(c => {
    const recencyDays = c.lastOrderDate
      ? Math.floor((Date.now() - new Date(c.lastOrderDate).getTime()) / 86400000)
      : 999;
    const totalOrders = Number(c.totalOrders);
    const totalSpent = Number(c.totalSpent);
    const avgOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;
    const segment = computeRFMSegment(recencyDays, totalOrders, totalSpent);
    const clv = avgOrderValue * totalOrders * 12;

    return {
      id: c.id,
      name: c.name,
      email: c.email,
      totalOrders,
      totalSpent,
      segment,
      clv: Math.round(clv),
      lastOrderDate: c.lastOrderDate ? new Date(c.lastOrderDate).toISOString() : null,
      createdAt: c.createdAt.toISOString(),
    };
  });

  const filtered = params.data.segment
    ? customers.filter(c => c.segment === params.data.segment)
    : customers;

  res.json({
    items: filtered,
    total: Number(countResult[0].count),
    page,
    limit,
  });
});

router.get("/customers/:id", async (req, res): Promise<void> => {
  const params = GetCustomerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, params.data.id));
  if (!user) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  const orderStats = await db
    .select({
      totalOrders: sql<number>`COUNT(${ordersTable.id})`,
      totalSpent: sql<number>`COALESCE(SUM(${ordersTable.totalAmount}), 0)`,
      lastOrderDate: sql<Date | null>`MAX(${ordersTable.orderDate})`,
    })
    .from(ordersTable)
    .where(eq(ordersTable.userId, params.data.id));

  const recentOrdersRaw = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.userId, params.data.id))
    .orderBy(desc(ordersTable.orderDate))
    .limit(5);

  const recentOrders = await Promise.all(
    recentOrdersRaw.map(async (order) => {
      const items = await db
        .select({
          id: orderItemsTable.id,
          productId: orderItemsTable.productId,
          productName: productsTable.name,
          quantity: orderItemsTable.quantity,
          price: orderItemsTable.price,
        })
        .from(orderItemsTable)
        .leftJoin(productsTable, eq(productsTable.id, orderItemsTable.productId))
        .where(eq(orderItemsTable.orderId, order.id));

      return {
        id: order.id,
        userId: order.userId,
        customerName: user.name,
        totalAmount: Number(order.totalAmount),
        orderDate: order.orderDate.toISOString(),
        status: order.status,
        items: items.map(i => ({
          id: i.id,
          productId: i.productId,
          productName: i.productName ?? "Unknown",
          quantity: i.quantity,
          price: Number(i.price),
        })),
      };
    })
  );

  const stats = orderStats[0];
  const totalOrders = Number(stats.totalOrders);
  const totalSpent = Number(stats.totalSpent);
  const lastOrderDate = stats.lastOrderDate;
  const recencyDays = lastOrderDate
    ? Math.floor((Date.now() - new Date(lastOrderDate).getTime()) / 86400000)
    : 999;
  const segment = computeRFMSegment(recencyDays, totalOrders, totalSpent);
  const avgOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;
  const clv = avgOrderValue * totalOrders * 12;
  const rfmRaw = computeRFMScores(recencyDays, totalOrders, totalSpent);
  const rfmScore = { ...rfmRaw, total: rfmRaw.recency + rfmRaw.frequency + rfmRaw.monetary };

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    totalOrders,
    totalSpent,
    segment,
    clv: Math.round(clv),
    lastOrderDate: lastOrderDate ? new Date(lastOrderDate).toISOString() : null,
    createdAt: user.createdAt.toISOString(),
    recentOrders,
    rfmScore,
  });
});

export default router;
