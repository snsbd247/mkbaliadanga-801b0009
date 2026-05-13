/**
 * Minimal HTTP API entry — health, readiness, and a hook for future routes.
 * Business logic modules (auth, farmers, irrigation, etc.) plug in here.
 */
import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.get("/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));

app.get("/ready", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, db: "up" });
  } catch (e: any) {
    res.status(503).json({ ok: false, error: e?.message });
  }
});

app.get("/", (_req, res) =>
  res.json({ name: "mk-api", status: "running", docs: "/health" })
);

// TODO: mount domain routers here:
// app.use("/auth",     authRouter);
// app.use("/farmers",  farmerRouter);
// app.use("/loans",    loanRouter);
// app.use("/irrigation", irrigationRouter);

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
  console.log(`[mk-api] listening on :${PORT}`);
});
