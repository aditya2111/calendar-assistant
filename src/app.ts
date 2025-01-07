import express from "express";
import bookingRoutes from "./routes/bookingRoutes";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const app = express();
app.use(express.json());
app.use("/api", bookingRoutes);

const PORT = process.env.PORT || 3000;

// Add cleanup handlers
process.on("SIGTERM", async () => {
  console.log("Received SIGTERM signal");
  await cleanup();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("Received SIGINT signal");
  await cleanup();
  process.exit(0);
});

// Global error handler
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error("Unhandled error:", err);
    res.status(500).json({
      error: "Internal server error",
    });
  }
);

const server = app
  .listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  })
  .on("error", (err: Error) => {
    console.error("Server failed to start:", err);
    process.exit(1);
  });

async function cleanup() {
  try {
    console.log("Starting server cleanup...");

    // Close server
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) {
          console.error("Error closing server:", err);
          reject(err);
        } else {
          console.log("Server closed successfully");
          resolve();
        }
      });
    });
    console.log("Cleanup completed successfully");
  } catch (error) {
    console.error("Error during cleanup:", error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on("uncaughtException", async (error: Error) => {
  console.error("Uncaught Exception:", error);
  await cleanup();
  process.exit(1);
});

// Handle unhandled rejections
process.on("unhandledRejection", async (reason: any) => {
  console.error("Unhandled Rejection:", reason);
  await cleanup();
  process.exit(1);
});

export default app;
