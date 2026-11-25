import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { connectDB } from "./config/database.js";
import { requireAdmin } from "./middleware/auth.js";
import authRoutes from "./routes/authRoutes.js";
import committeeRoutes from "./routes/committeeRoutes.js";
import drawRoutes from "./routes/drawRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";

dotenv.config();
const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });
app.use("/api/auth/login", loginLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/committees", requireAdmin, committeeRoutes);
app.use("/api/draw", requireAdmin, drawRoutes);
app.use("/api/reports", requireAdmin, reportRoutes);

app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.use(express.static(path.join(root, "frontend")));
app.get("/", (req, res) => res.sendFile(path.join(root, "frontend", "index.html")));

app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || (err.code === 11000 ? 409 : 500);
  res.status(status).json({ message: status === 500 ? "Something went wrong. Please try again." : err.message });
});

const port = process.env.PORT || 5000;
await connectDB();
app.listen(port, () => console.log(`Qameeti Manager running at http://localhost:${port}`));
