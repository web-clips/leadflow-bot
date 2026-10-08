import express from "express";
import cors from "cors";
import leadsRoute from "./routes/leads.routes.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({
    message: "LeadFlow API works",
  });
});

app.use("/api/leads", leadsRoute);

export default app;
