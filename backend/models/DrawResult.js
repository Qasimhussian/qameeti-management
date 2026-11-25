import mongoose from "mongoose";

const schema = new mongoose.Schema({
  committeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Committee", required: true },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: "DrawSession", required: true },
  committeeMemberId: { type: mongoose.Schema.Types.ObjectId, ref: "CommitteeMember", required: true },
  monthId: { type: mongoose.Schema.Types.ObjectId, required: true },
  monthName: { type: String, required: true },
  monthOrder: { type: Number, required: true }
}, { timestamps: true });

schema.index({ committeeId: 1, committeeMemberId: 1 }, { unique: true });
schema.index({ committeeId: 1, monthId: 1 }, { unique: true });
export default mongoose.model("DrawResult", schema);
