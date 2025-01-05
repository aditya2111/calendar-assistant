import { Pool } from "pg";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Verify environment variables are loaded
if (!process.env.DB_USER || !process.env.DB_PASSWORD) {
  console.error("Database configuration not found in environment variables");
  throw new Error("Database configuration not found");
}
const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "Booking",
  password: process.env.DB_PASSWORD || "root",
  port: parseInt(process.env.DB_PORT || "5432"),
});

export default pool;
