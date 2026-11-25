
import { Router } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import Committee from "../models/Committee.js";
import Member from "../models/Member.js";
import CommitteeMember from "../models/CommitteeMember.js";
import DrawResult from "../models/DrawResult.js";
import AuditLog from "../models/AuditLog.js";

const router = Router();

const createSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().max(500).optional().default(""),
  totalMembers: z.number().int().min(1).max(5000),
  totalMonths: z.number().int().min(1).max(120),
  drawMethod: z.enum(["full", "monthly"]),
  startDate: z.string().min(1),
  months: z.array(z.object({
    name: z.string().trim().min(1).max(40),
    order: z.number().int().min(1)
  })).min(1).max(120)
});

// GET ALL COMMITTEES
router.get("/", async (req, res, next) => {
  try {
    const committees = await Committee.find()
      .sort({ createdAt: -1 })
      .lean();

    const ids = committees.map(c => c._id);

    const [memberCounts, resultCounts] = await Promise.all([
      CommitteeMember.aggregate([
        { $match: { committeeId: { $in: ids } } },
        { $group: { _id: "$committeeId", count: { $sum: 1 } } }
      ]),
      DrawResult.aggregate([
        { $match: { committeeId: { $in: ids } } },
        { $group: { _id: "$committeeId", count: { $sum: 1 } } }
      ])
    ]);

    const mc = new Map(memberCounts.map(x => [String(x._id), x.count]));
    const rc = new Map(resultCounts.map(x => [String(x._id), x.count]));

    res.json({
      committees: committees.map(c => ({
        ...c,
        memberCount: mc.get(String(c._id)) || 0,
        completedMonths: rc.get(String(c._id)) || 0
      }))
    });
  } catch (err) {
    next(err);
  }
});

// CREATE COMMITTEE
router.post("/", async (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        message: parsed.error.issues[0].message
      });
    }

    const data = parsed.data;

    if (data.months.length !== data.totalMonths) {
      return res.status(400).json({
        message: "Number of month entries must equal total draw months."
      });
    }

    const orders = data.months.map(m => m.order);
    const names = data.months.map(m => m.name.toLowerCase());

    if (
      new Set(orders).size !== orders.length ||
      new Set(names).size !== names.length
    ) {
      return res.status(400).json({
        message: "Month names and order numbers must be unique."
      });
    }

    if (!Number.isFinite(Date.parse(data.startDate))) {
      return res.status(400).json({
        message: "Enter a valid start date."
      });
    }

    const committee = await Committee.create({
      ...data,
      startDate: new Date(data.startDate),
      status: "draft"
    });

    await AuditLog.create({
      adminId: req.admin.id,
      action: "COMMITTEE_CREATED",
      description: `Created ${committee.name}`,
      metadata: { committeeId: committee._id }
    });

    res.status(201).json({ committee });
  } catch (err) {
    next(err);
  }
});

// GET ONE COMMITTEE
router.get("/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid committee ID."
      });
    }

    const committee = await Committee.findById(req.params.id).lean();

    if (!committee) {
      return res.status(404).json({
        message: "Committee not found."
      });
    }

    const members = await CommitteeMember.find({
      committeeId: committee._id
    }).populate("memberId").lean();

    const results = await DrawResult.find({
      committeeId: committee._id
    })
      .sort({ monthOrder: 1 })
      .populate({
        path: "committeeMemberId",
        populate: { path: "memberId" }
      })
      .lean();

    res.json({ committee, members, results });
  } catch (err) {
    next(err);
  }
});

// ADD MEMBER
router.post("/:id/members", async (req, res, next) => {
  try {
    const { fullName, phone = "", address = "" } = req.body;

    if (
      typeof fullName !== "string" ||
      fullName.trim().length < 2
    ) {
      return res.status(400).json({
        message: "Enter a member name."
      });
    }

    const committee = await Committee.findById(req.params.id);

    if (!committee) {
      return res.status(404).json({
        message: "Committee not found."
      });
    }

    if (
      committee.methodLocked ||
      committee.status === "completed" ||
      committee.status === "archived"
    ) {
      return res.status(409).json({
        message: "Members cannot be changed after the first draw."
      });
    }

    const count = await CommitteeMember.countDocuments({
      committeeId: committee._id
    });

    if (count >= committee.totalMembers) {
      return res.status(409).json({
        message: "Committee member limit reached."
      });
    }

    const member = await Member.create({
      fullName: fullName.trim(),
      phone: String(phone).trim(),
      address: String(address).trim()
    });

    try {
      await CommitteeMember.create({
        committeeId: committee._id,
        memberId: member._id
      });
    } catch (err) {
      await Member.findByIdAndDelete(member._id);
      throw err;
    }

    committee.status = "active";
    await committee.save();

    await AuditLog.create({
      adminId: req.admin.id,
      action: "MEMBER_ADDED",
      description: `Added ${member.fullName} to ${committee.name}`
    });

    res.status(201).json({ member });
  } catch (err) {
    next(err);
  }
});

// GET COMMITTEE MEMBERS
router.get("/:id/members", async (req, res, next) => {
  try {
    const members = await CommitteeMember.find({
      committeeId: req.params.id
    }).populate("memberId").lean();

    res.json({ members });
  } catch (err) {
    next(err);
  }
});

// DELETE COMPLETED COMMITTEE
// DrawResult, DrawSession, CommitteeMember aur Member records delete nahi honge.
router.delete("/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid committee ID."
      });
    }

    const committee = await Committee.findById(req.params.id);

    if (!committee) {
      return res.status(404).json({
        message: "Committee not found."
      });
    }

    if (committee.status !== "completed") {
      return res.status(409).json({
        message: "Only completed committees can be deleted."
      });
    }

    await Committee.findByIdAndDelete(committee._id);

    await AuditLog.create({
      adminId: req.admin.id,
      action: "COMMITTEE_DELETED",
      description: `Deleted completed committee ${committee.name}; history and member records retained.`,
      metadata: { committeeId: committee._id }
    });

    res.json({
      message: "Committee deleted. Draw history and member records have been kept."
    });
  } catch (err) {
    next(err);
  }
});

export default router;
