import mongoose from "mongoose";

const schema = new mongoose.Schema({
  committeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Committee", required: true },
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: "Member", required: true },
  status: { type: String, enum: ["active", "inactive"], default: "active" }
}, { timestamps: true });

schema.index({ committeeId: 1, memberId: 1 }, { unique: true });
export default mongoose.model("CommitteeMember", schema);
