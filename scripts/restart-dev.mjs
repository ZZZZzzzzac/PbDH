import { spawn, spawnSync } from "node:child_process";
import { closeSync, mkdirSync, openSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const logRoot = path.join(repoRoot, ".scratch", "dev-servers");
const commandShell = process.env.ComSpec ?? "cmd.exe";
const fileServerRoot = repoRoot.replaceAll("\\", "/");

const services = [
  {
    name: "Backend",
    port: 8001,
    launcherMarkers: ["npm.cmd", "run dev:backend"],
    command: "npm.cmd run dev:backend",
    healthUrls: ["http://localhost:8001/api/auth/config"],
  },
  {
    name: "Platform",
    port: 5173,
    launcherMarkers: ["npm.cmd", "run dev", "@pbdh/platform"],
    command: "npm.cmd run dev -w @pbdh/platform -- --port 5173 --strictPort",
    healthUrls: [
      "http://localhost:5173/src/PlatformApp.tsx",
      `http://localhost:5173/@fs/${fileServerRoot}/apps/player/src/PlayerAppPrototype.tsx`,
      `http://localhost:5173/@fs/${fileServerRoot}/apps/creator/src/workspace-prototype/CreatorWorkspacePrototype.tsx`,
      `http://localhost:5173/@fs/${fileServerRoot}/apps/market/src/MarketApp.tsx`,
    ],
  },
];

const legacyLaunchers = [
  { name: "Creator/GM", launcherMarkers: ["npm.cmd", "run dev", "@pbdh/creator"] },
  { name: "Market", launcherMarkers: ["npm.cmd", "run dev", "@pbdh/market"] },
  { name: "Player", launcherMarkers: ["npm.cmd", "run dev", "@pbdh/player"] },
];
const managedPorts = [8001, 5173, 5174, 5175];

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function listWindowsProcesses() {
  const command = [
    "Get-CimInstance Win32_Process",
    "Select-Object ProcessId, ParentProcessId, Name, CommandLine",
    "ConvertTo-Json -Compress",
  ].join(" | ");
  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-Command", command],
    { encoding: "utf8", windowsHide: true },
  );
  if (result.status !== 0) {
    throw new Error(`无法读取开发进程：${result.stderr.trim()}`);
  }

  const output = result.stdout.replace(/^\uFEFF/, "").trim();
  if (!output) return [];
  const processes = JSON.parse(output);
  return Array.isArray(processes) ? processes : [processes];
}

function matchesMarkers(processInfo, markers) {
  const commandLine = processInfo.CommandLine?.toLocaleLowerCase() ?? "";
  return markers.every((marker) =>
    commandLine.includes(marker.toLocaleLowerCase()),
  );
}

function stopPreviousServices() {
  const processes = listWindowsProcesses();
  for (const service of [...services, ...legacyLaunchers]) {
    const launchers = processes.filter(
      (processInfo) =>
        processInfo.Name?.toLocaleLowerCase() === "cmd.exe" &&
        matchesMarkers(processInfo, service.launcherMarkers),
    );
    for (const launcher of launchers) {
      const result = spawnSync(
        "taskkill.exe",
        ["/PID", String(launcher.ProcessId), "/T", "/F"],
        { encoding: "utf8", windowsHide: true },
      );
      if (result.status !== 0) {
        throw new Error(
          `无法终止 ${service.name} 的旧进程 ${launcher.ProcessId}：${result.stderr.trim()}`,
        );
      }
    }
  }
}

function canBind(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.listen({ host: "127.0.0.1", port, exclusive: true }, () => {
      server.close(() => resolve(true));
    });
  });
}

async function waitForReleasedPorts() {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const states = await Promise.all(
      managedPorts.map(async (port) => ({
        port,
        available: await canBind(port),
      })),
    );
    const occupied = states.filter((state) => !state.available);
    if (occupied.length === 0) return;
    await delay(250);
  }

  const occupied = [];
  for (const port of managedPorts) {
    if (!(await canBind(port))) occupied.push(port);
  }
  throw new Error(`开发端口未释放：${occupied.join(", ")}`);
}

function startServices() {
  mkdirSync(logRoot, { recursive: true });
  return new Map(
    services.map((service) => {
      const logPrefix = service.name.replaceAll("/", "-").toLocaleLowerCase();
      const stdout = openSync(path.join(logRoot, `${logPrefix}.stdout.log`), "w");
      const stderr = openSync(path.join(logRoot, `${logPrefix}.stderr.log`), "w");
      const launcher = spawn(
        commandShell,
        ["/d", "/s", "/c", service.command],
        {
          cwd: repoRoot,
          detached: true,
          windowsHide: true,
          stdio: ["ignore", stdout, stderr],
        },
      );
      closeSync(stdout);
      closeSync(stderr);
      launcher.unref();
      return [service.name, launcher];
    }),
  );
}

async function healthCheck(service) {
  try {
    const responses = await Promise.all(service.healthUrls.map((url) => fetch(url, {
      signal: AbortSignal.timeout(3_000),
    })));
    return responses.every((response) => response.status === 200);
  } catch {
    return false;
  }
}

async function waitForHealthyServices(launchers) {
  const deadline = Date.now() + 30_000;
  let pending = [...services];
  while (Date.now() < deadline) {
    for (const service of pending) {
      if (launchers.get(service.name).exitCode !== null) {
        throw new Error(`${service.name} 启动进程提前退出，请检查 ${logRoot}。`);
      }
    }
    const results = await Promise.all(
      pending.map(async (service) => ({
        service,
        healthy: await healthCheck(service),
      })),
    );
    pending = results
      .filter((result) => !result.healthy)
      .map((result) => result.service);
    if (pending.length === 0) return;
    await delay(500);
  }
  throw new Error(
    `健康检查失败：${pending.map((service) => service.name).join(", ")}。请检查 ${logRoot}。`,
  );
}

if (process.platform !== "win32") {
  throw new Error("restart-dev.mjs 当前只支持项目约定的 Windows 开发环境。");
}

stopPreviousServices();
await waitForReleasedPorts();
const launchers = startServices();
await waitForHealthyServices(launchers);
console.table(
  services.map((service) => ({
    Service: service.name,
    Port: service.port,
    Health: "OK",
  })),
);
