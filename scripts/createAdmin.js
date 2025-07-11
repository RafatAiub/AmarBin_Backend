const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
dotenv.config();

const User = require("../models/User");

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const email = "rafat@amarbin.com"; // ✅ your admin email
    const existing = await User.findOne({ email });
    if (existing) {
      console.log("❌ Admin already exists");
      return process.exit(0);
    }

    const passwordHash = await bcrypt.hash("Rafat124260", 10);

    const user = await User.create({
      name: "Rafat",
      email,
      passwordHash,
      role: "admin",
    });

    console.log("✅ Admin created:", user);
    process.exit(0);
  } catch (err) {
    console.error("Error creating admin:", err);
    process.exit(1);
  }
};

createAdmin();
