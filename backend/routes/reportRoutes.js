import { Router } from "express";
import mongoose from "mongoose";
import PDFDocument from "pdfkit";
import Committee from "../models/Committee.js";
import DrawResult from "../models/DrawResult.js";

const router = Router();

router.get("/:committeeId/pdf", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.committeeId)) return res.status(400).json({ message: "Invalid committee ID." });
    const committee = await Committee.findById(req.params.committeeId);
    if (!committee) return res.status(404).json({ message: "Committee not found." });
    const results = await DrawResult.find({ committeeId: committee._id })
      .sort({ monthOrder: 1 })
      .populate({ path: "committeeMemberId", populate: { path: "memberId" } });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="qameeti-${committee._id}.pdf"`);
    const pdf = new PDFDocument({ margin: 48 });
    pdf.pipe(res);
    pdf.fontSize(22).fillColor("#173b67").text("Qameeti Draw Results");
    pdf.moveDown(0.5).fontSize(12).fillColor("#555").text(committee.name);
    pdf.text(`Draw method: ${committee.drawMethod === "full" ? "Full Committee Draw" : "Monthly Draw"}`);
    pdf.text(`Generated: ${new Date().toLocaleString()}`);
    pdf.moveDown();
    pdf.fontSize(11).fillColor("#111").text("Month", 48, pdf.y, { continued: true, width: 180 });
    pdf.text("Winner", 230, pdf.y);
    pdf.moveTo(48, pdf.y + 5).lineTo(550, pdf.y + 5).strokeColor("#ccd5df").stroke();
    pdf.moveDown(0.7);
    for (const r of results) {
      const winner = r.committeeMemberId?.memberId?.fullName || "Unknown";
      pdf.text(`${r.monthOrder}. ${r.monthName}`, 48, pdf.y, { continued: true, width: 180 });
      pdf.text(winner, 230, pdf.y);
      pdf.moveDown(0.55);
    }
    pdf.end();
  } catch (err) { next(err); }
});

export default router;
