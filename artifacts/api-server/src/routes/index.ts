import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import lmsRouter from "./lms.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(lmsRouter);

export default router;
