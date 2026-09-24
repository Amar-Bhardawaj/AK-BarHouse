export function installGracefulShutdown({ server, closeRuntime, timeoutMs = Number(process.env.SHUTDOWN_TIMEOUT_MS || 10000), exit = process.exit.bind(process) }) {
    let shuttingDown = false;
    const shutdown = signal => {
        if (shuttingDown) return;
        shuttingDown = true;
        console.log(`Received ${signal}; closing the server.`);
        const forceTimer = setTimeout(() => {
            console.error(`Graceful shutdown exceeded ${timeoutMs}ms; closing remaining connections.`);
            server.closeAllConnections?.();
            setTimeout(() => exit(1), 1000).unref();
        }, timeoutMs);
        forceTimer.unref();
        server.close(async error => {
            clearTimeout(forceTimer);
            if (error) console.error(`HTTP server shutdown failed: ${error.message}`);
            try {
                if (typeof closeRuntime === "function") await closeRuntime();
                exit(error ? 1 : 0);
            } catch (closeError) {
                console.error(`Runtime shutdown failed: ${closeError instanceof Error ? closeError.message : String(closeError)}`);
                exit(1);
            }
        });
    };
    process.once("SIGTERM", () => shutdown("SIGTERM"));
    process.once("SIGINT", () => shutdown("SIGINT"));
    return shutdown;
}
