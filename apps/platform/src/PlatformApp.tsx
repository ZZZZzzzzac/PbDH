import { useCallback, useEffect, useState } from "react";

import {
  CreatorAppSurface,
  type CreatorAppMode,
} from "@pbdh/creator/surface";
import { MarketAppSurface } from "@pbdh/market/surface";
import { PlayerAppSurface } from "@pbdh/player/surface";
import { PlatformChrome, type PlatformPage } from "@pbdh/platform-ui";

type PlatformLocation = {
  page: PlatformPage;
  href: string;
};

const platformPages = new Set<PlatformPage>(["player", "creator", "gm", "market"]);

function readPlatformLocation(source: string | URL = window.location.href): PlatformLocation {
  const url = new URL(source);
  const segment = url.pathname.split("/").filter(Boolean)[0];
  const page = platformPages.has(segment as PlatformPage)
    ? segment as PlatformPage
    : "creator";
  return { page, href: url.href };
}

export function PlatformApp() {
  const [location, setLocation] = useState<PlatformLocation>(() => readPlatformLocation());

  const commitLocation = useCallback((url: URL, replace: boolean) => {
    const relativeUrl = `${url.pathname}${url.search}${url.hash}`;
    if (replace) window.history.replaceState(null, "", relativeUrl);
    else window.history.pushState(null, "", relativeUrl);
    setLocation(readPlatformLocation(url));
  }, []);

  const navigate = useCallback((page: PlatformPage) => {
    commitLocation(new URL(`/${page}`, window.location.origin), false);
  }, [commitLocation]);

  const navigateHandoff = useCallback((target: "player" | "creator" | "gm", url: URL) => {
    commitLocation(url, false);
  }, [commitLocation]);

  const consumeHandoff = useCallback((cleanedUrl: URL) => {
    commitLocation(cleanedUrl, true);
  }, [commitLocation]);

  useEffect(() => {
    if (window.location.pathname === "/") {
      commitLocation(new URL("/creator", window.location.origin), true);
    }
    const restoreLocation = () => setLocation(readPlatformLocation());
    window.addEventListener("popstate", restoreLocation);
    return () => window.removeEventListener("popstate", restoreLocation);
  }, [commitLocation]);

  return <PlatformChrome activePage={location.page} onNavigate={navigate}>
    <div className="pbdh-platform-surfaces">
      <section className="pbdh-platform-surface" hidden={location.page !== "player"}>
        <PlayerAppSurface
          handoffUrl={location.href}
          onHandoffConsumed={consumeHandoff}
        />
      </section>
      <section className="pbdh-platform-surface" hidden={location.page !== "creator" && location.page !== "gm"}>
        <CreatorAppSurface
          mode={location.page === "gm" ? "gm" : "creator" as CreatorAppMode}
          onModeChange={navigate}
          handoffUrl={location.href}
          onHandoffConsumed={consumeHandoff}
        />
      </section>
      <section className="pbdh-platform-surface" hidden={location.page !== "market"}>
        <MarketAppSurface onHandoffNavigate={navigateHandoff} />
      </section>
    </div>
  </PlatformChrome>;
}
