import { spawn } from "node:child_process";
import path from "path";
import { existsSync } from "fs";

let serverProcess: ReturnType<typeof spawn> | null = null;
let serverReady = false;
let serverStartedByTests = false;

function getProjectRoot(): string {
    let currentDir = import.meta.dir;
    while (currentDir !== path.dirname(currentDir)) {
      const packageJsonPath = path.join(currentDir, "package.json");
      const envPath = path.join(currentDir, ".env");
      if (existsSync(packageJsonPath) && existsSync(envPath)) {
        return currentDir;
      }
      currentDir = path.dirname(currentDir);
    }
    return process.cwd();
  }
  
  async function checkServerRunning(host: string): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000);
  
      try {
        const response = await fetch(`${host}/`, {
          method: "GET",
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return response.status < 500;
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === "AbortError") {
          return false;
        }
        throw error;
      }
    } catch {
      return false;
    }
  }

async function waitForServer(host: string, maxAttempts = 30): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      if (await checkServerRunning(host)) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error(`Server at ${host} did not become ready after ${maxAttempts} seconds`);
  }
  
  async function startDevServer(): Promise<void> {
    if (serverProcess) {
      return;
    }
  
    const projectRoot = getProjectRoot();
    const frameworkPath = path.join(projectRoot, "packages/framework");
    const envFile = path.join(projectRoot, ".env");
  
    serverProcess = spawn(
      "bun",
      ["--cwd", frameworkPath, "--env-file", envFile, "dev"],
      {
        cwd: projectRoot,
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          NODE_ENV: "development",
        },
        shell: false,
        detached: false,
      }
    );
    
    if (!serverProcess.pid) {
      throw new Error("Failed to start dev server: no PID assigned");
    }
  
    serverStartedByTests = true;
  
    if (serverProcess.stdout) {
      serverProcess.stdout.on("data", (chunk: Buffer) => {
        const output = chunk.toString();
        if (!output.trim()) return;
        console.log(`[Server] ${output}`);
      });
    }
  
    if (serverProcess.stderr) {
      serverProcess.stderr.on("data", (chunk: Buffer) => {
        const output = chunk.toString();
        if (!output.trim()) return;
  
        const lines = output.split('\n').filter(line => line.trim());
        for (const line of lines) {
          if (line.startsWith('$ ') || line.includes('concurrently') || line.trim() === '' || line.includes('exited with code 1')) {
            continue;
          }
          console.error(`[Server Error] ${line}`);
        }
      });
    }
  
    serverProcess.on("exit", () => {
      serverProcess = null;
      serverStartedByTests = false;
      serverReady = false;
    });
  }
  
  async function killProcessTree(pid: number): Promise<void> {
    try {
      const { exec } = await import("node:child_process");
      const { promisify } = await import("node:util");
      const execAsync = promisify(exec);
      
      try {
        await execAsync(`pkill -P ${pid} 2>/dev/null || true`);
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch {
      }
      
      try {
        process.kill(-pid, "SIGTERM");
      } catch {
        try {
          process.kill(pid, "SIGTERM");
        } catch {
        }
      }
    } catch {
      try {
        process.kill(pid, "SIGTERM");
      } catch {
      }
    }
  }
  
  export async function stopDevServer(): Promise<void> {
    if (!serverProcess || !serverStartedByTests) {
      return;
    }
  
    const pid = serverProcess.pid;
    if (!pid) {
      serverProcess = null;
      serverStartedByTests = false;
      serverReady = false;
      return;
    }
  
    console.log(`Stopping dev server (PID: ${pid})...`);
    
    const processRef = serverProcess;
    
    try {
      await killProcessTree(pid);
      
      await new Promise<void>((resolve) => {
        let resolved = false;
        
        const timeout = setTimeout(async () => {
          if (resolved) return;
          resolved = true;
          try {
            const { exec } = await import("node:child_process");
            exec(`pkill -9 -P ${pid} 2>/dev/null || true`, () => {});
            process.kill(pid, "SIGKILL");
          } catch {
          }
          resolve();
        }, 3000);
  
        const checkInterval = setInterval(() => {
          try {
            process.kill(pid, 0);
          } catch {
            if (resolved) return;
            resolved = true;
            clearInterval(checkInterval);
            clearTimeout(timeout);
            resolve();
          }
        }, 100);
        
        processRef.on("exit", () => {
          if (resolved) return;
          resolved = true;
          clearInterval(checkInterval);
          clearTimeout(timeout);
          resolve();
        });
      });
    } catch (error) {
      if (error instanceof Error && !error.message.includes("kill") && !error.message.includes("ESRCH")) {
        console.error("Error stopping server:", error);
      }
    } finally {
      serverProcess = null;
      serverStartedByTests = false;
      serverReady = false;
      console.log("Dev server stopped");
    }
  }
  
  export async function ensureServerRunning(host?: string): Promise<void> {
    const testHost = host || process.env.ETE_UNIT_TEST_HOST;
  
    if (!testHost) {
      return;
    }
  
    if (serverReady) {
      const isRunning = await checkServerRunning(testHost);
      if (isRunning) {
        return;
      }
      serverReady = false;
    }
  
    const isRunning = await checkServerRunning(testHost);
  
    if (!isRunning) {
      console.log(`Starting dev server for tests...`);
      await startDevServer();
      await waitForServer(testHost);
      console.log(`Dev server is ready at ${testHost}`);
    }
  
    serverReady = true;
  }
  