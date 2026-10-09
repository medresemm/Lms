import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import lmsRouter from "./lms.js";
import aiRouter from "./ai.js";
import lessonAttendanceRouter from "./lessonAttendance.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(lessonAttendanceRouter);
router.use(lmsRouter);
router.use(aiRouter);

export default router;
