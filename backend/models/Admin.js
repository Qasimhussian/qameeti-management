import mongoose from "mongoose";

const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, lowercase: true },
  passwordHash: { type: String, required: true },
  active: { type: Boolean, default: true },
  lastLoginAt: Date
}, { timestamps: true });

export default mongoose.model("Admin", adminSchema);
