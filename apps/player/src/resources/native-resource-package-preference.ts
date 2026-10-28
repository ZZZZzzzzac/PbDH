// 原生数据包＝随预置系统包一起安装的资源包。玩家可以在资源管理器里按包禁用它们，
// 只保留 Market 与本地导入的第三方资源包。设置按浏览器持久化：禁用的包不再安装、
// 不进入人物卡的资源选择，但已存的数据保留，重新启用即可恢复。
export const nativeResourcePackagePreferenceKey = "pbdh:player:disabled-native-resource-packages";

export function loadDisabledNativeResourcePackageIds(): ReadonlySet<string> {
  try {
    // 无 DOM 的调用方（Node 测试、导入工具）没有 localStorage，按未禁用处理。
    const raw = globalThis.localStorage?.getItem(nativeResourcePackagePreferenceKey);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    return new Set(Array.isArray(parsed)
      ? parsed.filter((packageId): packageId is string => typeof packageId === "string")
      : []);
  } catch (error) {
    console.error("读取原生数据包设置失败", error);
    return new Set();
  }
}

// 返回是否写入成功：浏览器拒绝存储时调用方要提示，而不是让界面和设置对不上。
export function setNativeResourcePackageDisabled(packageId: string, disabled: boolean): boolean {
  try {
    const packageIds = new Set(loadDisabledNativeResourcePackageIds());
    if (disabled) packageIds.add(packageId);
    else packageIds.delete(packageId);
    if (packageIds.size) {
      globalThis.localStorage.setItem(nativeResourcePackagePreferenceKey, JSON.stringify([...packageIds]));
    } else {
      globalThis.localStorage.removeItem(nativeResourcePackagePreferenceKey);
    }
    return true;
  } catch (error) {
    console.error("保存原生数据包设置失败", error);
    return false;
  }
}
