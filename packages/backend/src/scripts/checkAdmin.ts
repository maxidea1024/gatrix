import database from "../config/database";
import bcrypt from "bcryptjs";

async function checkAdmin() {
  try {
    console.log("Checking admin user...");

    // Check if admin user exists
    const users = await database.query(
      "SELECT id, name, email, passwordHash, role, status, emailVerified FROM g_users WHERE role = ?",
      ["admin"],
    );

    console.log("Admin users found:", users.length);

    if (users.length > 0) {
      const admin = users[0];
      console.log("Admin user details:", {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        status: admin.status,
        emailVerified: admin.emailVerified,
        hasPassword: !!admin.passwordHash,
        passwordLength: admin.passwordHash ? admin.passwordHash.length : 0,
      });

      // Test password verification
      if (admin.passwordHash) {
        const testPassword = "admin123";
        const isValid = await bcrypt.compare(testPassword, admin.passwordHash);
        console.log(`Password verification for "${testPassword}":`, isValid);

        // Also test with environment variable
        const envPassword = process.env.ADMIN_PASSWORD || "admin123";
        const isValidEnv = await bcrypt.compare(
          envPassword,
          admin.passwordHash,
        );
        console.log(
          `Password verification for env password "${envPassword}":`,
          isValidEnv,
        );
      }
    } else {
      console.log("No admin user found!");

      // Check all users
      const allUsers = await database.query(
        "SELECT id, name, email, role FROM g_users",
      );
      console.log("All users:", allUsers);
    }
  } catch (error) {
    console.error("Error checking admin:", error);
  } finally {
    process.exit(0);
  }
}

checkAdmin();
