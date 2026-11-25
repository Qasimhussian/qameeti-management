import jwt from "jsonwebtoken";

export function requireAdmin(req, res, next) {
  const token = req.cookies?.qameeti_token;
  if (!token) return res.status(401).json({ message: "Please sign in to continue." });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = { id: payload.sub, username: payload.username };
    next();
  } catch {
    res.clearCookie("qameeti_token");
    return res.status(401).json({ message: "Session expired. Please sign in again." });
  }
}
