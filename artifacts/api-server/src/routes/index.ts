import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import lmsRouter from "./lms.js";
import aiRouter from "./ai.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(lmsRouter);
router.use(aiRouter);

export default router;
