import { afterAll, beforeAll } from "bun:test";
import { stopDevServer, ensureServerRunning } from "./utils/dev-server";

beforeAll(async () => {
    await ensureServerRunning();
});

afterAll(async () => {
    await stopDevServer();
});