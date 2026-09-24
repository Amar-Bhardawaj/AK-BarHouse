import dotenv from "dotenv";
import { validateProductionConfig } from "./config.js";
import { installGracefulShutdown } from "./db/shutdown.js";
dotenv.config();
const usePostgres = process.env.NODE_ENV === "production" || Boolean(process.env.DATABASE_URL);
if (usePostgres) validateProductionConfig();
const runtime = usePostgres
    ? await import("./server-postgres.js")
    : await import("./server.js");
const { app, pool, closePostgres } = runtime;

const port = Number(process.env.PORT || 3000);
const server = app.listen(port, () => console.log(`The Barrel House server is running at http://localhost:${port}`));

installGracefulShutdown({
    server,
    closeRuntime: typeof closePostgres === "function" ? () => closePostgres(pool) : undefined
});
