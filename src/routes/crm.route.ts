import express from "express";
import { getCustomers, getCustomerDetail, setCustomerTags } from "../controllers/crm.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = express.Router();

router.get("/customers", authenticate, getCustomers);
router.get("/customers/:email", authenticate, getCustomerDetail);
router.patch("/customers/:email/tags", authenticate, setCustomerTags);

export default router;