import { useCallback, useEffect, useState } from "react";

import {
  CreatorAppSurface,
  type CreatorAppMode,
} from "@pbdh/creator/surface";
import { MarketAppSurface } from "@pbdh/market/surface";
import { PlayerAppSurface, playerSystemPackageOptions } from "@pbdh/player/surface";
import { PlatformChrome, type PlatformPage } from "@pbdh/platform-ui";

import {
  normalizeBasePath,
  platformPageUrl,
  readPlatformLocation,
} from "./platform-route.ts";

const platformBasePath = normalizeBasePath(import.meta.env.BASE_URL);

export function PlatformApp() {
  const [location, setLocation] = useState(() => readPlatformLocation(
    window.location.href,
    platformBasePath,
  ));

  const commitLocation = useCallback((url: URL, replace: boolean) => {
    const relativeUrl = `${url.pathname}${url.search}${url.hash}`;
    if (replace) window.history.replaceState(null, "", relativeUrl);
    else window.history.pushState(null, "", relativeUrl);
    setLocation(readPlatformLocation(url, platformBasePath));
  }, []);

  const navigate = useCallback((page: PlatformPage) => {
    commitLocation(platformPageUrl(page, window.location.origin, platformBasePath), false);
  }, [commitLocation]);

  const navigateHandoff = useCallback((target: "player" | "creator" | "gm", url: URL) => {
    commitLocation(url, false);
  }, [commitLocation]);

  const navigateMarket = useCallback((url: URL, replace = false) => {
    commitLocation(url, replace);
  }, [commitLocation]);

  const consumeHandoff = useCallback((cleanedUrl: URL) => {
    commitLocation(cleanedUrl, true);
  }, [commitLocation]);

  useEffect(() => {
    if (
      window.location.pathname === platformBasePath
      || window.location.pathname === platformBasePath.slice(0, -1)
    ) {
      const defaultUrl = platformPageUrl("player", window.location.origin, platformBasePath);
      defaultUrl.pathname += "/daggerheart-core";
      commitLocation(defaultUrl, true);
    }
    const restoreLocation = () => setLocation(readPlatformLocation(
      window.location.href,
      platformBasePath,
    ));
    window.addEventListener("popstate", restoreLocation);
    return () => window.removeEventListener("popstate", restoreLocation);
  }, [commitLocation]);

  return <PlatformChrome activePage={location.page} onNavigate={navigate}>
    <div className="pbdh-platform-surfaces">
      <section className="pbdh-platform-surface" hidden={location.page !== "player"}>
        <PlayerAppSurface
          surfaceVisible={location.page === "player"}
          requestedSystemPackage={location.playerSystemPackage}
          handoffUrl={location.href}
          onHandoffConsumed={consumeHandoff}
        />
      </section>
      <section className="pbdh-platform-surface" hidden={location.page !== "creator" && location.page !== "gm"}>
        <CreatorAppSurface
          surfaceVisible={location.page === "creator" || location.page === "gm"}
          mode={location.page === "gm" ? "gm" : "creator" as CreatorAppMode}
          onModeChange={navigate}
          handoffUrl={location.href}
          onHandoffConsumed={consumeHandoff}
          systemPackageOptions={playerSystemPackageOptions}
        />
      </section>
      <section className="pbdh-platform-surface" hidden={location.page !== "market"}>
        <MarketAppSurface
          surfaceVisible={location.page === "market"}
          locationHref={location.href}
          onLocationNavigate={navigateMarket}
          onHandoffNavigate={navigateHandoff}
          basePath={platformBasePath}
          systemPackageOptions={playerSystemPackageOptions}
        />
      </section>
    </div>
  </PlatformChrome>;
}
