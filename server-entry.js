import dotenv from "dotenv";
dotenv.config();
const runtime = process.env.NODE_ENV === "production" || process.env.DATABASE_URL
    ? await import("./server-postgres.js")
    : await import("./server.js");
const { app, pool, closePostgres } = runtime;

const port = Number(process.env.PORT || 3000);
const server = app.listen(port, () => console.log(`The Barrel House server is running at http://localhost:${port}`));

const shutdown = async signal => {
    console.log(`Received ${signal}; closing the server.`);
    server.close(async () => {
        if (typeof closePostgres === "function") await closePostgres(pool);
        process.exit(0);
    });
};

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
