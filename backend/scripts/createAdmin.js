import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import Admin from "../models/Admin.js";

dotenv.config();
const rl = readline.createInterface({ input, output });
try {
  await mongoose.connect(process.env.MONGODB_URI);
  const username = (await rl.question("Admin username: ")).trim().toLowerCase();
  const password = await rl.question("Admin password (minimum 12 characters): ");
  if (!username || password.length < 12) throw new Error("Username required and password must be at least 12 characters.");
  const passwordHash = await bcrypt.hash(password, 12);
  await Admin.create({ username, passwordHash });
  console.log("✓ Admin account created. Keep your credentials private.");
} catch (err) {
  console.error("Could not create admin:", err.message);
  process.exitCode = 1;
} finally {
  rl.close();
  await mongoose.disconnect();
}
