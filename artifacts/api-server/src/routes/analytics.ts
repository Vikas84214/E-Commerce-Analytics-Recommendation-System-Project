import { Router, type IRouter } from "express";
import { db, ordersTable, orderItemsTable, productsTable, usersTable } from "@workspace/db";
import { eq, sql, desc, gte, and } from "drizzle-orm";
import { GetRevenueAnalyticsQueryParams, GetSalesReportQueryParams, GetRecentActivityQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/analytics/summary", async (_req, res): Promise<void> => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 86400000);

  const [totalRevResult, prevRevResult, totalOrdersResult, prevOrdersResult, totalCustomers, totalProducts] =
    await Promise.all([
      db.select({ total: sql<number>`COALESCE(SUM(${ordersTable.totalAmount}), 0)` })
        .from(ordersTable).where(gte(ordersTable.orderDate, thirtyDaysAgo)),
      db.select({ total: sql<number>`COALESCE(SUM(${ordersTable.totalAmount}), 0)` })
        .from(ordersTable).where(and(gte(ordersTable.orderDate, sixtyDaysAgo), sql`${ordersTable.orderDate} < ${thirtyDaysAgo}`)),
      db.select({ count: sql<number>`COUNT(*)` }).from(ordersTable).where(gte(ordersTable.orderDate, thirtyDaysAgo)),
      db.select({ count: sql<number>`COUNT(*)` }).from(ordersTable).where(and(gte(ordersTable.orderDate, sixtyDaysAgo), sql`${ordersTable.orderDate} < ${thirtyDaysAgo}`)),
      db.select({ count: sql<number>`COUNT(*)` }).from(usersTable).where(eq(usersTable.role, "customer")),
      db.select({ count: sql<number>`COUNT(*)` }).from(productsTable),
    ]);

  const totalRevenue = Number(totalRevResult[0].total);
  const prevRevenue = Number(prevRevResult[0].total);
  const totalOrders = Number(totalOrdersResult[0].count);
  const prevOrders = Number(prevOrdersResult[0].count);
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const revenueGrowth = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;
  const ordersGrowth = prevOrders > 0 ? ((totalOrders - prevOrders) / prevOrders) * 100 : 0;

  const prevCustomers = await db.select({ count: sql<number>`COUNT(*)` })
    .from(usersTable).where(and(eq(usersTable.role, "customer"), sql`${usersTable.createdAt} < ${thirtyDaysAgo}`));
  const currCustomers = Number(totalCustomers[0].count);
  const prevCust = Number(prevCustomers[0].count);
  const customersGrowth = prevCust > 0 ? ((currCustomers - prevCust) / prevCust) * 100 : 0;

  res.json({
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalOrders,
    totalCustomers: currCustomers,
    totalProducts: Number(totalProducts[0].count),
    avgOrderValue: Math.round(avgOrderValue * 100) / 100,
    revenueGrowth: Math.round(revenueGrowth * 10) / 10,
    ordersGrowth: Math.round(ordersGrowth * 10) / 10,
    customersGrowth: Math.round(customersGrowth * 10) / 10,
  });
});

router.get("/analytics/revenue", async (req, res): Promise<void> => {
  const params = GetRevenueAnalyticsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const period = params.data.period ?? "daily";
  const fromDate = params.data.from ? new Date(params.data.from) : new Date(Date.now() - 90 * 86400000);
  const toDate = params.data.to ? new Date(params.data.to) : new Date();

  let dateTrunc: string;
  if (period === "monthly") dateTrunc = "month";
  else if (period === "weekly") dateTrunc = "week";
  else dateTrunc = "day";

  const result = await db.execute(
    sql`SELECT DATE_TRUNC(${dateTrunc}, ${ordersTable.orderDate}) AS date,
               COALESCE(SUM(${ordersTable.totalAmount}), 0) AS revenue,
               COUNT(${ordersTable.id}) AS orders
        FROM ${ordersTable}
        WHERE ${ordersTable.orderDate} >= ${fromDate} AND ${ordersTable.orderDate} <= ${toDate}
        GROUP BY DATE_TRUNC(${dateTrunc}, ${ordersTable.orderDate})
        ORDER BY date ASC`
  );

  res.json((result as { rows: Array<{ date: Date; revenue: string; orders: string }> }).rows.map(r => ({
    date: new Date(r.date).toISOString().split("T")[0],
    revenue: Math.round(Number(r.revenue) * 100) / 100,
    orders: Number(r.orders),
  })));
});

router.get("/analytics/sales-report", async (req, res): Promise<void> => {
  const params = GetSalesReportQueryParams.safeParse(req.query);
  const period = params.success ? (params.data.period ?? "monthly") : "monthly";
  const dateTrunc = period === "monthly" ? "month" : "day";

  const result = await db.execute(
    sql`SELECT DATE_TRUNC(${dateTrunc}, o.${sql.raw("order_date")}) AS period_date,
               COALESCE(SUM(o.${sql.raw("total_amount")}), 0) AS revenue,
               COUNT(o.id) AS orders,
               COALESCE(AVG(o.${sql.raw("total_amount")}), 0) AS avg_order_value,
               (SELECT p.name FROM ${productsTable} p
                JOIN ${orderItemsTable} oi ON oi.${sql.raw("product_id")} = p.id
                JOIN ${ordersTable} o2 ON o2.id = oi.${sql.raw("order_id")}
                WHERE DATE_TRUNC(${dateTrunc}, o2.${sql.raw("order_date")}) = DATE_TRUNC(${dateTrunc}, o.${sql.raw("order_date")})
                GROUP BY p.id, p.name ORDER BY SUM(oi.quantity) DESC LIMIT 1) AS top_product
        FROM ${ordersTable} o
        GROUP BY DATE_TRUNC(${dateTrunc}, o.${sql.raw("order_date")})
        ORDER BY period_date DESC
        LIMIT 12`
  );

  res.json((result as { rows: Array<{ period_date: Date; revenue: string; orders: string; avg_order_value: string; top_product: string | null }> }).rows.map(r => ({
    period: new Date(r.period_date).toISOString().split("T")[0],
    revenue: Math.round(Number(r.revenue) * 100) / 100,
    orders: Number(r.orders),
    avgOrderValue: Math.round(Number(r.avg_order_value) * 100) / 100,
    topProduct: r.top_product ?? "N/A",
  })));
});

router.get("/analytics/profit", async (_req, res): Promise<void> => {
  const result = await db
    .select({
      category: productsTable.category,
      revenue: sql<number>`COALESCE(SUM(${orderItemsTable.quantity} * ${orderItemsTable.price}), 0)`,
      cost: sql<number>`COALESCE(SUM(${orderItemsTable.quantity} * ${orderItemsTable.price} * 0.6), 0)`,
    })
    .from(productsTable)
    .leftJoin(orderItemsTable, eq(orderItemsTable.productId, productsTable.id))
    .groupBy(productsTable.category)
    .orderBy(desc(sql`revenue`));

  const byCategory = result.map(r => {
    const revenue = Math.round(Number(r.revenue) * 100) / 100;
    const cost = Math.round(Number(r.cost) * 100) / 100;
    const profit = Math.round((revenue - cost) * 100) / 100;
    const margin = revenue > 0 ? Math.round(((profit / revenue) * 100) * 10) / 10 : 0;
    return { category: r.category, revenue, cost, profit, margin };
  });

  const totalRevenue = byCategory.reduce((s, c) => s + c.revenue, 0);
  const estimatedCost = byCategory.reduce((s, c) => s + c.cost, 0);
  const grossProfit = totalRevenue - estimatedCost;
  const grossMargin = totalRevenue > 0 ? Math.round(((grossProfit / totalRevenue) * 100) * 10) / 10 : 0;

  res.json({
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    estimatedCost: Math.round(estimatedCost * 100) / 100,
    grossProfit: Math.round(grossProfit * 100) / 100,
    grossMargin,
    byCategory,
  });
});

router.get("/analytics/recent-activity", async (req, res): Promise<void> => {
  const params = GetRecentActivityQueryParams.safeParse(req.query);
  const limit = params.success ? (params.data.limit ?? 10) : 10;

  const recentOrders = await db
    .select({
      id: ordersTable.id,
      totalAmount: ordersTable.totalAmount,
      orderDate: ordersTable.orderDate,
      customerName: usersTable.name,
    })
    .from(ordersTable)
    .leftJoin(usersTable, eq(usersTable.id, ordersTable.userId))
    .orderBy(desc(ordersTable.orderDate))
    .limit(limit);

  const activities = recentOrders.map(o => ({
    id: o.id,
    type: "order",
    description: `New order placed`,
    amount: Number(o.totalAmount),
    customerName: o.customerName ?? null,
    timestamp: o.orderDate.toISOString(),
  }));

  res.json(activities);
});

export default router;
