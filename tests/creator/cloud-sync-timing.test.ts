import { afterEach, expect, test, vi } from "vitest";
import { scheduleCreatorCloudSync } from "../../apps/creator/src/workspace-prototype/cloud-sync-timing.ts";

afterEach(() => vi.useRealTimers());

test("merges edits until ten seconds after the last change", () => {
  vi.useFakeTimers();
  const sync = vi.fn();
  let cancel = scheduleCreatorCloudSync(sync);
  for (let edit = 0; edit < 6; edit += 1) {
    vi.advanceTimersByTime(2000);
    expect(sync).not.toHaveBeenCalled();
    cancel();
    cancel = scheduleCreatorCloudSync(sync);
  }
  vi.advanceTimersByTime(9999);
  expect(sync).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(sync).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(30000);
  expect(sync).toHaveBeenCalledTimes(1);
});

test("cancels pending synchronization on cleanup", () => {
  vi.useFakeTimers();
  const sync = vi.fn();
  scheduleCreatorCloudSync(sync)();
  vi.advanceTimersByTime(20000);
  expect(sync).not.toHaveBeenCalled();
});
