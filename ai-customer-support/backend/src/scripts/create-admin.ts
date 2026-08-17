import dotenv from "dotenv";
import { connectDatabase } from "../config/database";
import { User } from "../models/User.model";

dotenv.config();

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const name = process.env.ADMIN_NAME?.trim() || "System Administrator";

const createAdmin = async () => {
  if (!email || !password) {
    console.error("ADMIN_EMAIL and ADMIN_PASSWORD are required");
    process.exit(1);
  }

  if (password.length < 6) {
    console.error("ADMIN_PASSWORD must be at least 6 characters");
    process.exit(1);
  }

  await connectDatabase();
  const existingUser = await User.findOne({ email }).select("+password");

  if (existingUser) {
    existingUser.name = name;
    existingUser.role = "admin";
    if (password) existingUser.password = password;
    await existingUser.save();
    console.log(`Admin account updated: ${existingUser.email}`);
  } else {
    const user = await User.create({ name, email, password, role: "admin" });
    console.log(`Admin account created: ${user.email}`);
  }

  process.exit(0);
};

createAdmin().catch((error) => {
  console.error("Admin creation failed:", error);
  process.exit(1);
});
