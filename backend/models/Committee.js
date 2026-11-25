
import mongoose from "mongoose";

const monthSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  order: {
    type: Number,
    required: true,
    min: 1
  }
});

const committeeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    default: "",
    maxlength: 500
  },
  totalMembers: {
    type: Number,
    required: true,
    min: 1
  },
  totalMonths: {
    type: Number,
    required: true,
    min: 1,
    max: 120
  },
  startDate: {
    type: Date,
    required: true
  },
  drawMethod: {
    type: String,
    enum: ["full", "monthly"],
    required: true
  },
  months: {
    type: [monthSchema],
    validate: {
      validator(v) {
        return v.length === this.totalMonths;
      },
      message: "Month list must match totalMonths"
    }
  },
  status: {
    type: String,
    enum: ["draft", "active", "completed", "archived"],
    default: "draft"
  },
  methodLocked: {
    type: Boolean,
    default: false
  },
  monthlyDrawSequence: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

export default mongoose.model("Committee", committeeSchema);
