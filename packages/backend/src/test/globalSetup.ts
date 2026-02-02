import mysql from "mysql2/promise";

export default async function globalSetup() {
  // Create test database if it doesn't exist
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306"),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
  });

  try {
    await connection.execute("CREATE DATABASE IF NOT EXISTS gate_test");
    console.log("Test database created or already exists");
  } catch (error) {
    console.error("Failed to create test database:", error);
  } finally {
    await connection.end();
  }
}
