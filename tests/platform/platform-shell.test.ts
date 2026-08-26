import { access, readFile, readdir } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const readSource = (path: string) => readFile(path, "utf8");

describe("Platform Shell composition", () => {
  it("owns the only production account provider and global app bar", async () => {
    const [main, shell] = await Promise.all([
      readSource("apps/platform/src/main.tsx"),
      readSource("apps/platform/src/PlatformApp.tsx"),
    ]);

    const appSourcePaths = (await readdir("apps", { recursive: true }))
      .filter((path) => /src[\\/].+\.tsx?$/u.test(path))
      .map((path) => `apps/${path.replaceAll("\\", "/")}`);
    const providerOwners = (
      await Promise.all(
        appSourcePaths.map(async (path) => ({ path, source: await readSource(path) })),
      )
    )
      .filter(({ source }) => source.includes("<AuthProvider"))
      .map(({ path }) => path);

    expect(main.match(/<AuthProvider/g)).toHaveLength(1);
    expect(providerOwners).toEqual(["apps/platform/src/main.tsx"]);
    expect(shell.match(/<PlatformChrome/g)).toHaveLength(1);
  });

  it("keeps leaf apps as surfaces without standalone launchers", async () => {
    for (const app of ["player", "creator", "market"]) {
      const packageJson = JSON.parse(
        await readSource(`apps/${app}/package.json`),
      ) as {
        scripts?: Record<string, string>;
        dependencies?: Record<string, string>;
      };

      expect(packageJson.scripts?.dev).toBeUndefined();
      expect(packageJson.scripts?.build).toBeUndefined();
      expect(packageJson.dependencies?.["react-dom"]).toBeUndefined();
      await expect(access(`apps/${app}/src/main.tsx`)).rejects.toThrow();
      await expect(access(`apps/${app}/index.html`)).rejects.toThrow();
      await expect(access(`apps/${app}/vite.config.ts`)).rejects.toThrow();
    }
  });

  it("composes surfaces that do not render their own global app bar", async () => {
    const surfaces = await Promise.all([
      readSource("apps/player/src/PlayerAppPrototype.tsx"),
      readSource("apps/creator/src/workspace-prototype/CreatorWorkspacePrototype.tsx"),
      readSource("apps/market/src/MarketApp.tsx"),
    ]);

    for (const source of surfaces) {
      expect(source).not.toMatch(/\bPlatformAppBar\b/u);
      expect(source).not.toContain("<AuthProvider");
    }
  });

  it("keeps all app surfaces in one Shell and routes Market handoff internally", async () => {
    const shell = await readSource("apps/platform/src/PlatformApp.tsx");

    expect(shell).toContain("<PlayerAppSurface");
    expect(shell).toContain("<CreatorAppSurface");
    expect(shell).toContain("<MarketAppSurface");
    expect(shell).toContain("onHandoffNavigate={navigateHandoff}");
  });
});
