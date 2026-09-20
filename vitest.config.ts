import { defineConfig } from "vitest/config";

// 内置资源包体量大（tttri 24.4MB / daggerheart-core 19.9MB），默认按「CPU-1」个 worker 并发解包时，
// 单个用例耗时会被拉长：隔离运行最慢用例约 0.7s，高负载下会打满 vitest 默认的 5s。
// 机器空闲时满并发与 8 worker 总耗时基本相同（16.8s / 17.6s），但负载高时满并发退化到 57.7s 并随机
// 超时，同期 8 worker 只需 32.9s。故并发取 CPU 的一半（CI 上自动降到 2），并把单用例上限放宽到 20s。
export default defineConfig({
  test: {
    testTimeout: 20_000,
    hookTimeout: 20_000,
    maxWorkers: "50%",
  },
});
