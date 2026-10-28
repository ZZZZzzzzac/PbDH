// 原生数据包＝随预置系统包一起安装的资源包（预置包内置清单里声明的那些）。
// 用户可以在 App Bar 的「系统包」菜单里禁用它们，只保留 Market 与本地导入的第三方资源包。
// 设置按浏览器持久化：禁用的包不安装、不进入资源库，但已存的数据保留，重新启用即可恢复。
export const nativeResourcePackagePreferenceKey = "pbdh:player:disable-native-resource-packages";

export function areNativeResourcePackagesDisabled(): boolean {
  try {
    // 无 DOM 的调用方（Node 测试、导入工具）没有 localStorage，按未禁用处理。
    return globalThis.localStorage?.getItem(nativeResourcePackagePreferenceKey) === "true";
  } catch (error) {
    console.error("读取原生数据包设置失败", error);
    return false;
  }
}

// 返回是否写入成功：浏览器拒绝存储时调用方要提示，而不是让界面和设置对不上。
export function setNativeResourcePackagesDisabled(disabled: boolean): boolean {
  try {
    if (disabled) globalThis.localStorage.setItem(nativeResourcePackagePreferenceKey, "true");
    else globalThis.localStorage.removeItem(nativeResourcePackagePreferenceKey);
    return true;
  } catch (error) {
    console.error("保存原生数据包设置失败", error);
    return false;
  }
}
