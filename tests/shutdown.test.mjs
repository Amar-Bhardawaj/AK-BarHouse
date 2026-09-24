import assert from "node:assert/strict";
import test from "node:test";
import { installGracefulShutdown } from "../db/shutdown.js";

test("graceful shutdown closes the runtime and exits successfully", async () => {
    const previous = [process.listeners("SIGTERM"), process.listeners("SIGINT")];
    let closed = false, exitCode;
    const server = { close(callback) { callback(); }, closeAllConnections() { assert.fail("force close should not run"); } };
    const shutdown = installGracefulShutdown({ server, closeRuntime: async () => { closed = true; }, timeoutMs: 100, exit: code => { exitCode = code; } });
    shutdown("SIGTERM");
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(closed, true);
    assert.equal(exitCode, 0);
    process.removeAllListeners("SIGTERM");
    process.removeAllListeners("SIGINT");
    for (const [event, listeners] of [["SIGTERM", previous[0]], ["SIGINT", previous[1]]]) for (const listener of listeners) process.on(event, listener);
});

test("graceful shutdown reports runtime cleanup failure", async () => {
    const previous = [process.listeners("SIGTERM"), process.listeners("SIGINT")];
    let exitCode;
    const server = { close(callback) { callback(); }, closeAllConnections() {} };
    const shutdown = installGracefulShutdown({ server, closeRuntime: async () => { throw new Error("pool failed"); }, timeoutMs: 100, exit: code => { exitCode = code; } });
    const previousError = console.error;
    console.error = () => {};
    try { shutdown("SIGINT"); await new Promise(resolve => setImmediate(resolve)); } finally { console.error = previousError; }
    assert.equal(exitCode, 1);
    process.removeAllListeners("SIGTERM");
    process.removeAllListeners("SIGINT");
    for (const [event, listeners] of [["SIGTERM", previous[0]], ["SIGINT", previous[1]]]) for (const listener of listeners) process.on(event, listener);
});
