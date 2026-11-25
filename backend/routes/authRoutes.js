import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";
import Admin from "../models/Admin.js";
import { requireAdmin } from "../middleware/auth.js";
import AuditLog from "../models/AuditLog.js";

const router = Router();
const loginSchema = z.object({
  username: z.string().trim().min(1).max(80),
  password: z.string().min(1).max(200)
});

router.post("/login", async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Enter a valid username and password." });
    const username = parsed.data.username.toLowerCase();
    const admin = await Admin.findOne({ username, active: true });
    if (!admin || !(await bcrypt.compare(parsed.data.password, admin.passwordHash))) {
      return res.status(401).json({ message: "Incorrect username or password." });
    }
    admin.lastLoginAt = new Date();
    await admin.save();
    const token = jwt.sign({ sub: admin._id.toString(), username }, process.env.JWT_SECRET, { expiresIn: "8h" });
    res.cookie("qameeti_token", token, {
      httpOnly: true, secure: process.env.COOKIE_SECURE === "true",
      sameSite: "strict", maxAge: 8 * 60 * 60 * 1000, path: "/"
    });
    await AuditLog.create({ adminId: admin._id, action: "LOGIN", description: "Admin signed in" });
    res.json({ admin: { username: admin.username } });
  } catch (err) { next(err); }
});

router.post("/logout", (req, res) => {
  res.clearCookie("qameeti_token", { httpOnly: true, secure: process.env.COOKIE_SECURE === "true", sameSite: "strict", path: "/" });
  res.json({ message: "Signed out." });
});

router.get("/me", requireAdmin, async (req, res) => {
  res.json({ admin: { username: req.admin.username } });
});

export default router;
