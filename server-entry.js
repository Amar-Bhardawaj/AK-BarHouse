import dotenv from "dotenv";
dotenv.config();
if (process.env.NODE_ENV === "production" || process.env.DATABASE_URL) await import("./server-postgres.js");
else await import("./server.js");
