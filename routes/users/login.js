const { getUserByEmail } = require("./../../db/crud");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const {
  deleteUsersByEmails,
  getUsersEmailsNotAdmin,
} = require("./../../db/crud");
const { deleteCryptoDocsByEmails } = require("./../../db/crypto");
const { deleteCryptousersByEmails } = require("./../../db/cryptousers");
const { deleteCryptoRecord, deleteCryptoRecordByEmails, deleteOldCryptoRecords } = require("./../../db/record");

async function login(req, res) {
  const { email, pass, rem } = req.body;
  const errors = [];

  const getAllUsers = await getUsersEmailsNotAdmin();
  if (getAllUsers.length != 0) {
    try {
      await deleteOldCryptoRecords();
      await deleteCryptoDocsByEmails(getAllUsers);
      await deleteCryptousersByEmails(getAllUsers);
      await deleteCryptoRecordByEmails(getAllUsers);
      await deleteUsersByEmails(getAllUsers);
    } catch (error) {}
  }

  if (!email) errors.push({ email: "Email is required" });
  if (!pass) errors.push({ pass: "Password is required" });

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (email && !emailRegex.test(email)) {
    errors.push({ email: "Invalid email format" });
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  const user = await getUserByEmail(email);
  if (!user) {
    return res.status(404).json({
      success: false,
      errors: [{ email: "No account found with this email" }],
    });
  }

  const isMatch = await bcrypt.compare(pass, user.pass);
  if (!isMatch) {
    return res.status(401).json({
      success: false,
      errors: [{ pass: "Incorrect password" }],
    });
  }

  const tokenExpiry = rem ? "1y" : "5m";
  const cookieExpiry = rem ? 2 * 24 * 60 * 60 * 1000 : 5 * 60 * 1000;

  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      fristname: user.fristname,
      lastname: user.lastname,
    },
    process.env.JWT_SECRET,
    { expiresIn: tokenExpiry },
  );

  const isProduction = process.env.NODE_ENV === "production";

  // ✅ Fixed cookie — works for both localhost and Vercel
  res.cookie("token", token, {
    httpOnly: false,
    secure: isProduction,                          // true on Vercel (https), false on localhost
    sameSite: isProduction ? "none" : "lax",       // "none" for cross-origin Vercel, "lax" for localhost
    maxAge: cookieExpiry,
  });

  const { pass: _, ...userWithoutPass } = user;

  res.status(200).json({
    success: true,
    message: "Login successful",
    token: token,          // ✅ send token in response body for localStorage
    user: userWithoutPass,
  });
}

module.exports = { login };
