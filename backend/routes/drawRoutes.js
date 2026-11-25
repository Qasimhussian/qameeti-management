
import { Router } from "express";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import Committee from "../models/Committee.js";
import CommitteeMember from "../models/CommitteeMember.js";
import DrawSession from "../models/DrawSession.js";
import DrawResult from "../models/DrawResult.js";
import AuditLog from "../models/AuditLog.js";
import { secureShuffle, secureChoice } from "../services/drawService.js";

const router = Router();

async function runInTransaction(work) {
  const session = await mongoose.startSession();

  try {
    let output;

    await session.withTransaction(async () => {
      output = await work(session);
    });

    return output;
  } finally {
    await session.endSession();
  }
}

// Pakistan time ke mutabiq aglay calendar month ki pehli tareekh.
function getNextPakistanMonthStart(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit"
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts.map(part => [part.type, part.value])
  );

  const year = Number(values.year);
  const month = Number(values.month);

  // Pakistan UTC+5 hai.
  return new Date(Date.UTC(year, month, 1) - 5 * 60 * 60 * 1000);
}

function formatPakistanDate(date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Karachi",
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(date);
}

// FULL DRAW
router.post("/full/:committeeId", async (req, res, next) => {
  try {
    const id = req.params.committeeId;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid committee." });
    }

    const key = req.get("Idempotency-Key") || randomUUID();

    const result = await runInTransaction(async session => {
      const committee = await Committee.findOneAndUpdate(
        {
          _id: id,
          drawMethod: "full",
          methodLocked: false,
          status: { $in: ["draft", "active"] }
        },
        { $set: { methodLocked: true } },
        { new: true, session }
      );

      if (!committee) {
        throw Object.assign(
          new Error("Committee not found, already drawn, or not configured for full draw."),
          { status: 409 }
        );
      }

      if (committee.totalMonths > committee.totalMembers) {
        throw Object.assign(
          new Error("Draw months cannot exceed total members."),
          { status: 400 }
        );
      }

      const members = await CommitteeMember.find({
        committeeId: id,
        status: "active"
      }).session(session);

      if (members.length !== committee.totalMembers) {
        throw Object.assign(
          new Error(`Add all ${committee.totalMembers} members before drawing.`),
          { status: 409 }
        );
      }

      const existing = await DrawResult.countDocuments({
        committeeId: id
      }).session(session);

      if (existing) {
        throw Object.assign(
          new Error("Draw results already exist."),
          { status: 409 }
        );
      }

      const shuffled = secureShuffle(members);
      const months = [...committee.months].sort(
        (a, b) => a.order - b.order
      );

      const drawSession = await DrawSession.create(
        [{
          committeeId: id,
          drawType: "full",
          status: "completed",
          idempotencyKey: key,
          resultCount: months.length,
          createdBy: req.admin.id
        }],
        { session }
      );

      const docs = months.map((month, i) => ({
        committeeId: id,
        sessionId: drawSession[0]._id,
        committeeMemberId: shuffled[i]._id,
        monthId: month._id,
        monthName: month.name,
        monthOrder: month.order
      }));

      await DrawResult.insertMany(docs, { session });

      if (months.length === committee.totalMonths) {
        committee.status = "completed";
        await committee.save({ session });
      }

      return {
        sessionId: drawSession[0]._id,
        results: docs
      };
    });

    await AuditLog.create({
      adminId: req.admin.id,
      action: "FULL_DRAW_COMPLETED",
      description: `Full draw completed for ${id}`,
      metadata: { sessionId: result.sessionId }
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// MONTHLY DRAW
router.post("/monthly/:committeeId", async (req, res, next) => {
  try {
    const id = req.params.committeeId;
    const { monthId } = req.body;

    if (
      !mongoose.isValidObjectId(id) ||
      !mongoose.isValidObjectId(monthId)
    ) {
      return res.status(400).json({
        message: "Invalid committee or month."
      });
    }

    const key = req.get("Idempotency-Key") || randomUUID();

    const result = await runInTransaction(async session => {
      // Committee document ko atomically update karna concurrent
      // draw requests ko serialize karne mein madad karta hai.
      const committee = await Committee.findOneAndUpdate(
        {
          _id: id,
          drawMethod: "monthly",
          status: { $in: ["draft", "active"] }
        },
        {
          $set: {
            methodLocked: true,
            status: "active"
          },
          $inc: {
            monthlyDrawSequence: 1
          }
        },
        { new: true, session }
      );

      if (!committee) {
        throw Object.assign(
          new Error("Committee not found or not configured for monthly draw."),
          { status: 409 }
        );
      }

      // Aakhri monthly draw ki date se lock calculate karo.
      // Is se pehle ke existing draw records bhi lock mein count honge.
      const lastMonthlySession = await DrawSession.findOne({
        committeeId: id,
        drawType: "monthly",
        status: "completed"
      })
        .sort({ createdAt: -1 })
        .session(session);

      const now = new Date();

      if (lastMonthlySession) {
        const unlockAt = getNextPakistanMonthStart(
          lastMonthlySession.createdAt
        );

        if (now < unlockAt) {
          throw Object.assign(
            new Error(
              `Monthly committee locked hai. Dobara draw ${formatPakistanDate(unlockAt)} ko Pakistan time ke mutabiq unlock hoga.`
            ),
            { status: 409 }
          );
        }
      }

      if (committee.totalMonths > committee.totalMembers) {
        throw Object.assign(
          new Error("Draw months cannot exceed total members."),
          { status: 400 }
        );
      }

      const month = committee.months.id(monthId);

      if (!month) {
        throw Object.assign(
          new Error("Month does not belong to this committee."),
          { status: 400 }
        );
      }

      const alreadyDrawn = await DrawResult.exists({
        committeeId: id,
        monthId
      }).session(session);

      if (alreadyDrawn) {
        throw Object.assign(
          new Error("This month has already been drawn."),
          { status: 409 }
        );
      }

      const allMembers = await CommitteeMember.find({
        committeeId: id,
        status: "active"
      }).session(session);

      if (allMembers.length !== committee.totalMembers) {
        throw Object.assign(
          new Error(`Add all ${committee.totalMembers} members before drawing.`),
          { status: 409 }
        );
      }

      const previous = await DrawResult.find({
        committeeId: id
      })
        .distinct("committeeMemberId")
        .session(session);

      const previousSet = new Set(previous.map(String));

      const eligible = allMembers.filter(
        member => !previousSet.has(String(member._id))
      );

      if (!eligible.length) {
        throw Object.assign(
          new Error("No eligible members remaining."),
          { status: 409 }
        );
      }

      const winner = secureChoice(eligible);

      const drawSession = await DrawSession.create(
        [{
          committeeId: id,
          drawType: "monthly",
          status: "completed",
          idempotencyKey: key,
          resultCount: 1,
          createdBy: req.admin.id
        }],
        { session }
      );

      const doc = {
        committeeId: id,
        sessionId: drawSession[0]._id,
        committeeMemberId: winner._id,
        monthId: month._id,
        monthName: month.name,
        monthOrder: month.order
      };

      await DrawResult.create([doc], { session });

      const count = await DrawResult.countDocuments({
        committeeId: id
      }).session(session);

      if (count === committee.totalMonths) {
        committee.status = "completed";
        await committee.save({ session });
      }

      return {
        sessionId: drawSession[0]._id,
        result: doc
      };
    });

    await AuditLog.create({
      adminId: req.admin.id,
      action: "MONTHLY_DRAW_COMPLETED",
      description: `Monthly draw completed for ${id}`,
      metadata: { sessionId: result.sessionId }
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// DRAW HISTORY
router.get("/history/:committeeId", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.committeeId)) {
      return res.status(400).json({
        message: "Invalid committee."
      });
    }

    const results = await DrawResult.find({
      committeeId: req.params.committeeId
    })
      .sort({ monthOrder: 1 })
      .populate({
        path: "committeeMemberId",
        populate: { path: "memberId" }
      })
      .populate("sessionId")
      .lean();

    res.json({ results });
  } catch (err) {
    next(err);
  }
});

export default router;
