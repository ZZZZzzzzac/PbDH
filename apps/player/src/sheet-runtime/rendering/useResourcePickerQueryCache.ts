import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadResourcePickerQueries,
  resourcePickerQuerySaveDelayMs,
  saveResourcePickerQueries,
  type ResourcePickerQueriesByLibrary,
} from "../storage/resourcePickerQueryCache";

/**
 * 按 System Package + Character Save + Module 记忆资源库查询。
 * 查询变化防抖写入 localStorage，关闭弹窗时立即落盘。
 */
export function useResourcePickerQueryCache(
  packageId: string,
  characterSaveId: string | null,
  moduleId: string,
) {
  const [queriesByLibrary, setQueriesByLibrary] = useState<ResourcePickerQueriesByLibrary>(() =>
    loadResourcePickerQueries(packageId, characterSaveId, moduleId));
  const latestQueries = useRef(queriesByLibrary);
  latestQueries.current = queriesByLibrary;
  const identity = useRef({ characterSaveId, moduleId, packageId });

  const persist = useCallback(() => {
    saveResourcePickerQueries(packageId, characterSaveId, moduleId, latestQueries.current);
  }, [characterSaveId, moduleId, packageId]);

  // 切换存档或系统包：先把旧身份的查询落盘，再载入新身份的缓存。
  useEffect(() => {
    const previous = identity.current;
    if (previous.packageId === packageId
      && previous.characterSaveId === characterSaveId
      && previous.moduleId === moduleId) return;
    identity.current = { characterSaveId, moduleId, packageId };
    saveResourcePickerQueries(previous.packageId, previous.characterSaveId, previous.moduleId, latestQueries.current);
    if (!characterSaveId) return;
    // 新建角色刚拿到存档 ID 时保留内存里的筛选；其余情况读取目标存档的缓存。
    if (!previous.characterSaveId) return;
    setQueriesByLibrary(loadResourcePickerQueries(packageId, characterSaveId, moduleId));
  }, [characterSaveId, moduleId, packageId]);

  // 筛选输入不逐字同步 localStorage。
  useEffect(() => {
    if (!packageId || !characterSaveId) return;
    const timer = window.setTimeout(persist, resourcePickerQuerySaveDelayMs);
    return () => window.clearTimeout(timer);
  }, [characterSaveId, moduleId, packageId, persist, queriesByLibrary]);

  return { persist, queriesByLibrary, setQueriesByLibrary };
}
