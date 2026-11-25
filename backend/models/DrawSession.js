import mongoose from "mongoose";

const schema = new mongoose.Schema({
  committeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Committee", required: true },
  drawType: { type: String, enum: ["full", "monthly"], required: true },
  status: { type: String, enum: ["completed"], default: "completed" },
  idempotencyKey: { type: String, required: true },
  resultCount: { type: Number, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true }
}, { timestamps: true });

schema.index({ committeeId: 1, idempotencyKey: 1 }, { unique: true });
export default mongoose.model("DrawSession", schema);
