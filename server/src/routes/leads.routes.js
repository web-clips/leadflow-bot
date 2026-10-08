import express from "express";
import { getLeads } from "../controllers/leads.controller.js";

const router = express.Router();

router.get("/", getLeads);

export default router;