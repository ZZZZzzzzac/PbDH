const command = process.argv[2];
const version = process.argv[3] ?? "";

if (command !== "check-version") {
  throw new Error("Usage: node scripts/release-tools.mjs check-version <X.Y.Z>");
}
if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
  throw new Error(`Invalid release version: ${version}`);
}
