import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import productsRouter from "./products";
import customersRouter from "./customers";
import ordersRouter from "./orders";
import analyticsRouter from "./analytics";
import recommendationsRouter from "./recommendations";
import forecastingRouter from "./forecasting";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(productsRouter);
router.use(customersRouter);
router.use(ordersRouter);
router.use(analyticsRouter);
router.use(recommendationsRouter);
router.use(forecastingRouter);

export default router;
