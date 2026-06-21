import { Router, type IRouter } from "express";
import { db, ordersTable, orderItemsTable, productsTable } from "@workspace/db";
import { eq, sql, desc, gte } from "drizzle-orm";
import { GetSalesForecastQueryParams, GetDemandForecastParams } from "@workspace/api-zod";

const router: IRouter = Router();

// Simple linear regression for forecasting
function linearRegression(points: number[]): { slope: number; intercept: number } {
  const n = points.length;
  if (n === 0) return { slope: 0, intercept: 0 };
  const sumX = (n * (n - 1)) / 2;
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
  const sumY = points.reduce((s, v) => s + v, 0);
  const sumXY = points.reduce((s, v, i) => s + v * i, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

router.get("/forecasting/sales", async (req, res): Promise<void> => {
  const params = GetSalesForecastQueryParams.safeParse(req.query);
  const periods = params.success ? (params.data.periods ?? 30) : 30;
  const granularity = params.success ? (params.data.granularity ?? "daily") : "daily";

  const dateTrunc = granularity === "monthly" ? "month" : granularity === "weekly" ? "week" : "day";

  // Get historical data
  const historical = await db.execute(
    sql`SELECT DATE_TRUNC(${dateTrunc}, ${ordersTable.orderDate}) AS period_date,
               COALESCE(SUM(${ordersTable.totalAmount}), 0) AS revenue
        FROM ${ordersTable}
        GROUP BY DATE_TRUNC(${dateTrunc}, ${ordersTable.orderDate})
        ORDER BY period_date ASC`
  );

  const rows = (historical as { rows: Array<{ period_date: Date; revenue: string }> }).rows;

  // Build actuals
  const actuals = rows.map(r => ({
    date: new Date(r.period_date).toISOString().split("T")[0],
    value: Math.round(Number(r.revenue) * 100) / 100,
  }));

  // Calculate average and trend
  const values = actuals.map(a => a.value);
  const { slope, intercept } = linearRegression(values);
  const avgValue = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 500;
  const stdDev = values.length > 1
    ? Math.sqrt(values.reduce((s, v) => s + Math.pow(v - avgValue, 2), 0) / values.length)
    : avgValue * 0.15;

  // Generate forecast points
  const lastDate = actuals.length > 0 ? new Date(actuals[actuals.length - 1].date) : new Date();
  const forecast = [];

  for (let i = 1; i <= periods; i++) {
    const predicted = Math.max(0, intercept + slope * (values.length + i - 1));
    const ci = stdDev * 1.645; // 90% confidence interval
    const forecastDate = addDays(lastDate, i * (granularity === "monthly" ? 30 : granularity === "weekly" ? 7 : 1));

    forecast.push({
      date: forecastDate.toISOString().split("T")[0],
      predicted: Math.round(predicted * 100) / 100,
      lower: Math.max(0, Math.round((predicted - ci) * 100) / 100),
      upper: Math.round((predicted + ci) * 100) / 100,
      actual: null,
    });
  }

  // Combine actuals and forecast
  const result = [
    ...actuals.slice(-30).map(a => ({
      date: a.date,
      predicted: a.value,
      lower: Math.max(0, Math.round((a.value - stdDev) * 100) / 100),
      upper: Math.round((a.value + stdDev) * 100) / 100,
      actual: a.value,
    })),
    ...forecast,
  ];

  res.json(result);
});

router.get("/forecasting/demand/:productId", async (req, res): Promise<void> => {
  const params = GetDemandForecastParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const historical = await db.execute(
    sql`SELECT DATE_TRUNC('week', o.${sql.raw("order_date")}) AS week_date,
               COALESCE(SUM(oi.quantity), 0) AS demand
        FROM ${orderItemsTable} oi
        JOIN ${ordersTable} o ON o.id = oi.${sql.raw("order_id")}
        WHERE oi.${sql.raw("product_id")} = ${params.data.productId}
        GROUP BY DATE_TRUNC('week', o.${sql.raw("order_date")})
        ORDER BY week_date ASC`
  );

  const rows = (historical as { rows: Array<{ week_date: Date; demand: string }> }).rows;
  const values = rows.map(r => Number(r.demand));
  const { slope, intercept } = linearRegression(values);
  const avgDemand = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 10;
  const stdDev = values.length > 1
    ? Math.sqrt(values.reduce((s, v) => s + Math.pow(v - avgDemand, 2), 0) / values.length)
    : avgDemand * 0.2;

  const lastDate = rows.length > 0 ? new Date(rows[rows.length - 1].week_date) : new Date();

  const actuals = rows.map(r => ({
    date: new Date(r.week_date).toISOString().split("T")[0],
    predicted: Number(r.demand),
    lower: Math.max(0, Number(r.demand) - stdDev),
    upper: Number(r.demand) + stdDev,
    actual: Number(r.demand),
  }));

  const forecast = Array.from({ length: 8 }, (_, i) => {
    const predicted = Math.max(0, intercept + slope * (values.length + i));
    const ci = stdDev * 1.3;
    const forecastDate = addDays(lastDate, (i + 1) * 7);
    return {
      date: forecastDate.toISOString().split("T")[0],
      predicted: Math.round(predicted * 10) / 10,
      lower: Math.max(0, Math.round((predicted - ci) * 10) / 10),
      upper: Math.round((predicted + ci) * 10) / 10,
      actual: null,
    };
  });

  res.json([...actuals.slice(-12), ...forecast]);
});

router.get("/forecasting/inventory", async (_req, res): Promise<void> => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

  const products = await db
    .select({
      id: productsTable.id,
      name: productsTable.name,
      stock: productsTable.stock,
      avgDailyDemand: sql<number>`COALESCE(SUM(${orderItemsTable.quantity})::float / 30, 0)`,
    })
    .from(productsTable)
    .leftJoin(orderItemsTable, eq(orderItemsTable.productId, productsTable.id))
    .leftJoin(ordersTable, sql`${ordersTable.id} = ${orderItemsTable.orderId} AND ${ordersTable.orderDate} >= ${thirtyDaysAgo}`)
    .groupBy(productsTable.id)
    .orderBy(productsTable.id);

  const result = products.map(p => {
    const avgDailyDemand = Number(p.avgDailyDemand);
    const currentStock = p.stock;
    const daysUntilStockout = avgDailyDemand > 0 ? currentStock / avgDailyDemand : null;
    const reorderPoint = Math.ceil(avgDailyDemand * 14); // 2 weeks lead time

    let recommendation = "Stock level adequate";
    if (daysUntilStockout !== null && daysUntilStockout < 7) {
      recommendation = "URGENT: Reorder immediately";
    } else if (daysUntilStockout !== null && daysUntilStockout < 14) {
      recommendation = "Reorder soon";
    } else if (currentStock > avgDailyDemand * 90) {
      recommendation = "Overstock: consider promotions";
    }

    return {
      productId: p.id,
      productName: p.name,
      currentStock,
      predictedDemand: Math.round(avgDailyDemand * 30 * 10) / 10,
      reorderPoint,
      daysUntilStockout: daysUntilStockout !== null ? Math.round(daysUntilStockout) : null,
      recommendation,
    };
  });

  res.json(result);
});

export default router;
