import mongoose from "mongoose";

const memberSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true, maxlength: 120 },
  phone: { type: String, trim: true, default: "", maxlength: 30 },
  address: { type: String, trim: true, default: "", maxlength: 250 }
}, { timestamps: true });

export default mongoose.model("Member", memberSchema);
