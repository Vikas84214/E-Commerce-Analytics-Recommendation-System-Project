import { Router, type IRouter } from "express";
import { db, productsTable, orderItemsTable, ordersTable } from "@workspace/db";
import { eq, ilike, sql, desc, and } from "drizzle-orm";
import {
  CreateProductBody,
  UpdateProductBody,
  UpdateProductParams,
  GetProductParams,
  DeleteProductParams,
  ListProductsQueryParams,
  GetTopSellingProductsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/products/top-selling", async (req, res): Promise<void> => {
  const params = GetTopSellingProductsQueryParams.safeParse(req.query);
  const limit = params.success ? (params.data.limit ?? 10) : 10;

  const result = await db
    .select({
      id: productsTable.id,
      name: productsTable.name,
      category: productsTable.category,
      rating: productsTable.rating,
      totalSold: sql<number>`COALESCE(SUM(${orderItemsTable.quantity}), 0)`.as("total_sold"),
      revenue: sql<number>`COALESCE(SUM(${orderItemsTable.quantity} * ${orderItemsTable.price}), 0)`.as("revenue"),
    })
    .from(productsTable)
    .leftJoin(orderItemsTable, eq(orderItemsTable.productId, productsTable.id))
    .groupBy(productsTable.id)
    .orderBy(desc(sql`total_sold`))
    .limit(limit);

  res.json(result.map(r => ({
    id: r.id,
    name: r.name,
    category: r.category,
    totalSold: Number(r.totalSold),
    revenue: Number(r.revenue),
    rating: Number(r.rating),
  })));
});

router.get("/products/category-performance", async (_req, res): Promise<void> => {
  const result = await db
    .select({
      category: productsTable.category,
      productCount: sql<number>`COUNT(DISTINCT ${productsTable.id})`.as("product_count"),
      totalSales: sql<number>`COALESCE(SUM(${orderItemsTable.quantity}), 0)`.as("total_sales"),
      revenue: sql<number>`COALESCE(SUM(${orderItemsTable.quantity} * ${orderItemsTable.price}), 0)`.as("revenue"),
      avgRating: sql<number>`AVG(${productsTable.rating})`.as("avg_rating"),
    })
    .from(productsTable)
    .leftJoin(orderItemsTable, eq(orderItemsTable.productId, productsTable.id))
    .groupBy(productsTable.category)
    .orderBy(desc(sql`revenue`));

  res.json(result.map(r => ({
    category: r.category,
    totalSales: Number(r.totalSales),
    revenue: Number(r.revenue),
    productCount: Number(r.productCount),
    avgRating: Number(r.avgRating ?? 0).toFixed(2),
  })));
});

router.get("/products", async (req, res): Promise<void> => {
  const params = ListProductsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { category, search, page = 1, limit = 20 } = params.data;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (category) conditions.push(eq(productsTable.category, category));
  if (search) conditions.push(ilike(productsTable.name, `%${search}%`));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [items, countResult] = await Promise.all([
    db.select().from(productsTable)
      .where(whereClause)
      .orderBy(desc(productsTable.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`COUNT(*)` }).from(productsTable).where(whereClause),
  ]);

  res.json({
    items: items.map(p => ({
      ...p,
      price: Number(p.price),
      rating: Number(p.rating),
      createdAt: p.createdAt.toISOString(),
    })),
    total: Number(countResult[0].count),
    page,
    limit,
  });
});

router.post("/products", async (req, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [product] = await db.insert(productsTable).values({
    name: parsed.data.name,
    category: parsed.data.category,
    price: String(parsed.data.price),
    stock: parsed.data.stock,
    rating: String(parsed.data.rating ?? 0),
    description: parsed.data.description ?? null,
    imageUrl: parsed.data.imageUrl ?? null,
  }).returning();

  res.status(201).json({
    ...product,
    price: Number(product.price),
    rating: Number(product.rating),
    createdAt: product.createdAt.toISOString(),
  });
});

router.get("/products/:id", async (req, res): Promise<void> => {
  const params = GetProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, params.data.id));
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.json({
    ...product,
    price: Number(product.price),
    rating: Number(product.rating),
    createdAt: product.createdAt.toISOString(),
  });
});

router.patch("/products/:id", async (req, res): Promise<void> => {
  const params = UpdateProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.category !== undefined) updateData.category = parsed.data.category;
  if (parsed.data.price !== undefined) updateData.price = String(parsed.data.price);
  if (parsed.data.stock !== undefined) updateData.stock = parsed.data.stock;
  if (parsed.data.rating !== undefined) updateData.rating = String(parsed.data.rating);
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
  if (parsed.data.imageUrl !== undefined) updateData.imageUrl = parsed.data.imageUrl;

  const [product] = await db.update(productsTable).set(updateData).where(eq(productsTable.id, params.data.id)).returning();
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.json({
    ...product,
    price: Number(product.price),
    rating: Number(product.rating),
    createdAt: product.createdAt.toISOString(),
  });
});

router.delete("/products/:id", async (req, res): Promise<void> => {
  const params = DeleteProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [product] = await db.delete(productsTable).where(eq(productsTable.id, params.data.id)).returning();
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
