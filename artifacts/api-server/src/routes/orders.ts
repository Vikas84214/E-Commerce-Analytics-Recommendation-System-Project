import { Router, type IRouter } from "express";
import { db, ordersTable, orderItemsTable, productsTable, usersTable } from "@workspace/db";
import { eq, sql, desc, and, gte, lte } from "drizzle-orm";
import { CreateOrderBody, GetOrderParams, ListOrdersQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

async function getOrderWithItems(orderId: number) {
  const [order] = await db.select({
    id: ordersTable.id,
    userId: ordersTable.userId,
    totalAmount: ordersTable.totalAmount,
    status: ordersTable.status,
    orderDate: ordersTable.orderDate,
    customerName: usersTable.name,
  })
    .from(ordersTable)
    .leftJoin(usersTable, eq(usersTable.id, ordersTable.userId))
    .where(eq(ordersTable.id, orderId));

  if (!order) return null;

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
    .where(eq(orderItemsTable.orderId, orderId));

  return {
    id: order.id,
    userId: order.userId,
    customerName: order.customerName ?? null,
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
}

router.get("/orders", async (req, res): Promise<void> => {
  const params = ListOrdersQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { page = 1, limit = 20, from, to } = params.data;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (from) conditions.push(gte(ordersTable.orderDate, new Date(from)));
  if (to) conditions.push(lte(ordersTable.orderDate, new Date(to)));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [rawOrders, countResult] = await Promise.all([
    db.select({
      id: ordersTable.id,
      userId: ordersTable.userId,
      totalAmount: ordersTable.totalAmount,
      status: ordersTable.status,
      orderDate: ordersTable.orderDate,
      customerName: usersTable.name,
    })
      .from(ordersTable)
      .leftJoin(usersTable, eq(usersTable.id, ordersTable.userId))
      .where(whereClause)
      .orderBy(desc(ordersTable.orderDate))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`COUNT(*)` }).from(ordersTable).where(whereClause),
  ]);

  const orders = await Promise.all(
    rawOrders.map(async (order) => {
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
        customerName: order.customerName ?? null,
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

  res.json({
    items: orders,
    total: Number(countResult[0].count),
    page,
    limit,
  });
});

router.post("/orders", async (req, res): Promise<void> => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Fetch product prices
  const productIds = parsed.data.items.map(i => i.productId);
  const products = await db.select().from(productsTable).where(
    sql`${productsTable.id} = ANY(${sql.raw(`ARRAY[${productIds.join(",")}]`)})`
  );

  const productMap = new Map(products.map(p => [p.id, p]));
  let totalAmount = 0;
  const itemsWithPrice = parsed.data.items.map(item => {
    const product = productMap.get(item.productId);
    const price = product ? Number(product.price) : 0;
    totalAmount += price * item.quantity;
    return { ...item, price };
  });

  const [order] = await db.insert(ordersTable).values({
    userId: parsed.data.userId,
    totalAmount: String(totalAmount),
    status: "completed",
  }).returning();

  await db.insert(orderItemsTable).values(
    itemsWithPrice.map(item => ({
      orderId: order.id,
      productId: item.productId,
      quantity: item.quantity,
      price: String(item.price),
    }))
  );

  const fullOrder = await getOrderWithItems(order.id);
  res.status(201).json(fullOrder);
});

router.get("/orders/:id", async (req, res): Promise<void> => {
  const params = GetOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const order = await getOrderWithItems(params.data.id);
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  res.json(order);
});

export default router;
