import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";


function read(path: string): string {
  return readFileSync(path, "utf8");
}


describe("production deployment", () => {
  test("runs a single native backend process on loopback", () => {
    const service = read("deploy/pbdh-platform.service");

    expect(service).toContain("--host 127.0.0.1");
    expect(service).toContain("--workers 1");
    expect(service).toContain("EnvironmentFile=/etc/pbdh-platform.env");
    expect(service).toContain("ReadWritePaths=/var/lib/pbdh-platform");
  });

  test("bundles pinned Linux dependencies without a server-side install", () => {
    const workflow = read(".github/workflows/release.yml");

    expect(workflow).toContain("python-version: \"3.10\"");
    expect(workflow).toContain("--target artifact/python-packages");
    expect(workflow).toContain("requirements-prod.txt");
    expect(workflow).not.toContain("artifact/wheelhouse");
  });

  test("publishes both preview and primary base paths", () => {
    const workflow = read(".github/workflows/release.yml");

    expect(workflow).toContain("PBDH_BASE_PATH: /pbdh_tools/");
    expect(workflow).toContain("PBDH_BASE_PATH: /pbdh/");
    expect(workflow).toContain("npm run verify");
  });
});
