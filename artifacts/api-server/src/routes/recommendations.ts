import { Router, type IRouter } from "express";
import { db, productsTable, orderItemsTable, ordersTable } from "@workspace/db";
import { eq, sql, desc, ne } from "drizzle-orm";
import { GetPersonalizedRecommendationsParams, GetSimilarProductsParams, GetTrendingProductsQueryParams, GetFrequentlyBoughtTogetherParams } from "@workspace/api-zod";

const router: IRouter = Router();

function formatProduct(p: { id: number; name: string; category: string; price: unknown; rating: unknown; imageUrl: string | null }, score: number, reason: string) {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    price: Number(p.price),
    rating: Number(p.rating),
    score,
    reason,
    imageUrl: p.imageUrl ?? null,
  };
}

router.get("/recommendations/personalized/:userId", async (req, res): Promise<void> => {
  const params = GetPersonalizedRecommendationsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  // Get user's purchased categories
  const userPurchases = await db
    .select({ category: productsTable.category, count: sql<number>`COUNT(*)` })
    .from(orderItemsTable)
    .leftJoin(ordersTable, eq(ordersTable.id, orderItemsTable.orderId))
    .leftJoin(productsTable, eq(productsTable.id, orderItemsTable.productId))
    .where(eq(ordersTable.userId, params.data.userId))
    .groupBy(productsTable.category)
    .orderBy(desc(sql`count`))
    .limit(3);

  const preferredCategories = userPurchases.map(p => p.category).filter(Boolean);

  // Get purchased product IDs
  const purchasedProductIds = await db
    .select({ productId: orderItemsTable.productId })
    .from(orderItemsTable)
    .leftJoin(ordersTable, eq(ordersTable.id, orderItemsTable.orderId))
    .where(eq(ordersTable.userId, params.data.userId));

  const purchasedIds = purchasedProductIds.map(p => p.productId);

  // Get top-rated products from preferred categories not yet purchased
  let recommendations = await db
    .select()
    .from(productsTable)
    .orderBy(desc(productsTable.rating))
    .limit(20);

  const filtered = recommendations
    .filter(p => !purchasedIds.includes(p.id))
    .slice(0, 8);

  const result = filtered.map(p => {
    const isPreferred = preferredCategories.includes(p.category);
    return formatProduct(p, isPreferred ? 0.95 : 0.75, isPreferred ? `Based on your interest in ${p.category}` : "Highly rated in our store");
  });

  res.json(result);
});

router.get("/recommendations/similar/:productId", async (req, res): Promise<void> => {
  const params = GetSimilarProductsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [targetProduct] = await db.select().from(productsTable).where(eq(productsTable.id, params.data.productId));
  if (!targetProduct) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const similar = await db
    .select()
    .from(productsTable)
    .where(sql`${productsTable.category} = ${targetProduct.category} AND ${productsTable.id} != ${params.data.productId}`)
    .orderBy(desc(productsTable.rating))
    .limit(6);

  res.json(similar.map(p => formatProduct(p, 0.88, `Similar to ${targetProduct.name}`)));
});

router.get("/recommendations/trending", async (req, res): Promise<void> => {
  const params = GetTrendingProductsQueryParams.safeParse(req.query);
  const limit = params.success ? (params.data.limit ?? 8) : 8;

  const recentDate = new Date(Date.now() - 30 * 86400000);

  const trending = await db
    .select({
      id: productsTable.id,
      name: productsTable.name,
      category: productsTable.category,
      price: productsTable.price,
      rating: productsTable.rating,
      imageUrl: productsTable.imageUrl,
      recentSales: sql<number>`COALESCE(SUM(${orderItemsTable.quantity}), 0)`,
    })
    .from(productsTable)
    .leftJoin(orderItemsTable, eq(orderItemsTable.productId, productsTable.id))
    .leftJoin(ordersTable, sql`${ordersTable.id} = ${orderItemsTable.orderId} AND ${ordersTable.orderDate} >= ${recentDate}`)
    .groupBy(productsTable.id)
    .orderBy(desc(sql`recent_sales`))
    .limit(limit);

  res.json(trending.map(p => ({
    id: p.id,
    name: p.name,
    category: p.category,
    price: Number(p.price),
    rating: Number(p.rating),
    score: Math.min(0.99, 0.7 + Number(p.recentSales) * 0.01),
    reason: "Trending this month",
    imageUrl: p.imageUrl ?? null,
  })));
});

router.get("/recommendations/bought-together/:productId", async (req, res): Promise<void> => {
  const params = GetFrequentlyBoughtTogetherParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  // Find orders that contain this product
  const ordersWithProduct = await db
    .select({ orderId: orderItemsTable.orderId })
    .from(orderItemsTable)
    .where(eq(orderItemsTable.productId, params.data.productId));

  const orderIds = ordersWithProduct.map(o => o.orderId);

  if (orderIds.length === 0) {
    // Fallback: return top-rated products from same category
    const [target] = await db.select().from(productsTable).where(eq(productsTable.id, params.data.productId));
    if (!target) {
      res.json([]);
      return;
    }
    const fallback = await db.select().from(productsTable)
      .where(sql`${productsTable.category} = ${target.category} AND ${productsTable.id} != ${params.data.productId}`)
      .orderBy(desc(productsTable.rating)).limit(4);
    res.json(fallback.map(p => formatProduct(p, 0.7, "Frequently bought together")));
    return;
  }

  const frequently = await db
    .select({
      id: productsTable.id,
      name: productsTable.name,
      category: productsTable.category,
      price: productsTable.price,
      rating: productsTable.rating,
      imageUrl: productsTable.imageUrl,
      coCount: sql<number>`COUNT(*)`,
    })
    .from(orderItemsTable)
    .leftJoin(productsTable, eq(productsTable.id, orderItemsTable.productId))
    .where(sql`${orderItemsTable.orderId} = ANY(ARRAY[${sql.raw(orderIds.join(","))}]::int[]) AND ${orderItemsTable.productId} != ${params.data.productId}`)
    .groupBy(productsTable.id)
    .orderBy(desc(sql`co_count`))
    .limit(4);

  res.json(frequently.map(p => ({
    id: p.id,
    name: p.name,
    category: p.category,
    price: Number(p.price),
    rating: Number(p.rating),
    score: Math.min(0.99, 0.65 + Number(p.coCount) * 0.05),
    reason: "Frequently bought together",
    imageUrl: p.imageUrl ?? null,
  })));
});

export default router;
