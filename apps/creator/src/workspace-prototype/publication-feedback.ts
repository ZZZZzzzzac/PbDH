import type { ContractDiagnostic } from "@pbdh/contract-runtime";

const publicationMessages: Record<string, string> = {
  AUTH_REQUIRED: "请先登录，再发布到资源市场。",
  "publication.auth.required": "请先登录，再发布到资源市场。",
  AUTH_SESSION_REPLACED: "当前设备的账号会话已失效，请在账号菜单中重新接管。",
  PUBLICATION_VERSION_CONFLICT: "当前内容与已发布版本不同。请提高 package.version 后再发布。",
  PACKAGE_ID_OWNED_BY_ANOTHER_ACCOUNT: "该资源包 ID 已由其他账号发布。",
  PUBLICATION_CANDIDATE_INVALID: "资源包未通过发布校验，请检查内容后重试。",
  PUBLICATION_REQUEST_FAILED: "发布失败，请稍后重试。",
  "contract.version.development-not-allowed": "当前资源包使用的文件格式尚未开放正式发布，请更新平台后重试，或联系平台管理员发布该 Contract 版本。",
  "contract.version.unsupported": "资源包使用的文件格式版本不受支持。请更新平台后重试，或用当前版本的 Creator 重新导出。",
  "template.version.unsupported": "资源使用了市场尚未支持的卡牌模板版本。",
  "creator.publication-cover.resource-missing": "资源包至少需要一项资源，才能生成发布封面。",
  "creator.publication-cover.render-failed": "资源包内没有可渲染为发布封面的资源卡，请检查卡面后重试。",
  "creator.market-handoff.snapshot-mismatch": "市场资源包版本校验失败，请返回资源市场后重试。",
  "creator.market-handoff.package-id-mismatch": "市场资源包身份校验失败，请返回资源市场后重试。",
  "creator.market-handoff.package-version-mismatch": "市场资源包版本校验失败，请返回资源市场后重试。",
  "creator.market-handoff.focus-resource-not-found": "市场资源定位已失效，请返回资源市场后重试。",
  "creator.market-handoff.request-failed": "无法从资源市场取得资源包，请确认服务已启动后重试。",
};

type DiagnosticParams = Record<string, unknown>;

function text(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join("、");
  return "";
}

/** 参数存在时才追加细节；服务端的 fieldErrors 不带 params，文案必须能在缺参时读通。 */
function when(value: unknown, format: (detail: string) => string): string {
  const detail = text(value);
  return detail ? format(detail) : "";
}

function inParentheses(value: unknown): string {
  return when(value, (detail) => `（${detail}）`);
}

function withSpace(value: unknown): string {
  return when(value, (detail) => ` ${detail}`);
}

function entryKind(value: unknown): string {
  const kinds: Record<string, string> = {
    "zip-special": "特殊文件类型",
    symlink: "符号链接",
    device: "设备文件",
  };
  const kind = text(value);
  return kinds[kind] ?? (kind ? `类型 ${kind}` : "类型不支持");
}

function pathReason(params: DiagnosticParams): string {
  const reasons: Record<string, string> = {
    empty: "路径为空",
    "too-long": "路径过长",
    absolute: "不能是绝对路径",
    backslash: "不能使用反斜杠",
    "empty-segment": "路径中存在空段",
    traversal: "不能包含 . 或 .. 段",
    "control-character": "包含控制字符",
    "trailing-space-or-dot": "段尾不能是空格或点",
    "windows-reserved": "使用了 Windows 保留文件名",
  };
  const reason = text(params.reason);
  return reasons[reason] ?? (reason ? `原因代码 ${reason}` : "无法识别具体原因");
}

/**
 * 资源包校验的诊断会说清「哪里不对、怎么改」。
 * 同一套文案也被 GM 桌面等文件复用，措辞保持中性；缺参时退化成没有细节的完整句子。
 */
const creatorDiagnosticMessages: Record<string, (params: DiagnosticParams) => string> = {
  // 快照与完整性
  "resource-package.snapshot-digest.mismatch": () =>
    "资源包内容与包内记录的摘要不一致：文件在打包后被直接改过。Creator 导入、Player 本地安装和系统包加载会按当前内容重算摘要；这里需要有与内容一致的摘要（市场交接按服务器记录的摘要比对，云端回读按原值校验），请用 Creator 重新导出或 `npm run pbres:pack` 重新封包。",
  "creator.import.snapshot-digest-recomputed": () =>
    "资源包内容与包内记录的摘要不一致，已按当前内容重算摘要后导入。下次导出会写入新摘要。",
  "resource-package.media.digest-mismatch": (params) =>
    `图片内容与其文件名不一致${when(text(params.actual), (actual) => `：实际内容对应 ${actual}`)}${
      when(params.expected, (expected) => `，文件名却是 ${expected}`)
    }。Creator 导入、Player 本地安装和系统包加载会按内容重命名图片；这个入口不做重算，请重新导出或重新封包。`,
  "resource-package.media.byte-length-mismatch": (params) => {
    const actual = text(params.actual);
    const expected = text(params.expected);
    const detail = actual || expected ? `：实际 ${actual || "未知"} 字节，声明 ${expected || "未知"} 字节` : "";
    return `图片大小与声明不一致${detail}。`;
  },
  "resource-package.media.bytes-missing": (params) =>
    `资源包缺少一张图片的数据${when(params.assetId, (assetId) => `：${assetId}`)}。`,
  "resource-package.media.asset-undeclared": (params) =>
    `资源引用了未在 assets 中声明的图片${inParentheses(params.assetId)}。`,
  "resource-package.publication-cover.asset-undeclared": (params) =>
    `发布封面引用的图片不在资源包里${inParentheses(params.assetId)}。请重新选择封面。`,
  "resource-package.resource-id.duplicate": (params) =>
    `资源 ID 重复${inParentheses(params.id)}。同一个资源包里每个资源 ID 只能出现一次。`,
  "resource-package.asset-id.duplicate": (params) =>
    `图片资产 ID 重复${inParentheses(params.id)}。同一张图片在资源包里只能出现一次。`,
  "resource-package.target.duplicate": (params) => {
    const target = [text(params.systemPackageId), text(params.version)].filter(Boolean).join(" ");
    return `目标系统重复声明${target ? `（${target}）` : ""}。同一个目标系统在资源包里只能声明一次。`;
  },
  "resource-package.replacement-id.duplicate": (params) =>
    `替换项 ID 重复${inParentheses(params.replacementId)}。同一张卡牌的替换项 ID 必须唯一。`,
  "resource-package.replacement-target.missing": (params) =>
    `替换项指向不存在的资源${inParentheses(params.targetResourceId)}。`,

  // 归档结构
  "resource-package.archive.zip.invalid": () =>
    "这个文件不是完整的 .pbres 压缩包，可能在下载、复制或重新打包时损坏了。请重新导出后再试。",
  "resource-package.archive.zip64.unsupported": () =>
    "资源包使用了 ZIP64 压缩格式，当前只支持普通 ZIP。请用 Creator 导出，或运行 `npm run pbres:pack` 重新封包。",
  "resource-package.archive.zip.encrypted": (params) =>
    `资源包里的文件被加密，无法读取${inParentheses(params.path)}。`,
  "resource-package.archive.zip.compression-unsupported": (params) =>
    `资源包里的文件${withSpace(params.path)}使用了当前不支持的压缩方式${inParentheses(params.compression)}，只支持不压缩和 Deflate。`,
  "resource-package.archive.entry-count-exceeded": (params) => {
    const actual = text(params.actual);
    const limit = text(params.limit);
    return `资源包条目过多${actual && limit ? `：${actual} 个，上限 ${limit} 个` : ""}。`;
  },
  "resource-package.archive.expanded-bytes-exceeded": (params) => {
    const actual = text(params.actual);
    const limit = text(params.limit);
    return `资源包解压后体积超出上限${actual && limit ? `：${actual} 字节，上限 ${limit} 字节` : ""}。`;
  },
  "resource-package.archive.file-too-large": (params) => {
    const actual = text(params.actual);
    const limit = text(params.limit);
    const detail = actual && limit ? `：${actual} 字节，单文件上限 ${limit} 字节` : "";
    return `资源包里的文件${withSpace(params.path)}太大${detail}。`;
  },
  "resource-package.archive.compression-ratio-exceeded": (params) => {
    const expanded = text(params.expanded);
    const compressed = text(params.compressed);
    const detail = expanded && compressed ? `：${expanded} 字节压成 ${compressed} 字节` : "";
    return `资源包里的文件${withSpace(params.path)}压缩比异常${detail}。`;
  },
  "resource-package.archive.path.invalid": (params) =>
    `资源包内有不合法的路径${withSpace(params.path)}：${pathReason(params)}。`,
  "resource-package.archive.path.encoding-invalid": () =>
    "资源包里有文件名不是 UTF-8 编码。重新封包时请让文件名保持 UTF-8。",
  "resource-package.archive.path.collision": (params) => {
    const first = text(params.first);
    const second = text(params.second);
    return first && second
      ? `${first} 与 ${second} 只有大小写或字符规范化不同，解包时会互相覆盖，请改成不同的文件名。`
      : "有两个文件的路径只有大小写或字符规范化不同，解包时会互相覆盖，请改成不同的文件名。";
  },
  "resource-package.archive.entry.duplicate": (params) =>
    `资源包里重复出现同一个文件${when(params.path, (path) => `：${path}`)}。`,
  "resource-package.archive.entry.special": (params) =>
    `资源包里有不支持的条目${withSpace(params.path)}（${entryKind(params.kind)}），只能包含普通文件和目录。`,
  "resource-package.archive.entry.type-mismatch": (params) =>
    `资源包里有条目的文件类型与声明不一致${when(params.path, (path) => `：${path}`)}。`,
  "resource-package.archive.file.bytes-missing": (params) =>
    `资源包条目缺少文件内容${when(params.path, (path) => `：${path}`)}。`,
  "resource-package.archive.file.unknown": (params) =>
    `资源包里有规则外的文件${when(params.path, (path) => `：${path}`)}。包内只允许 package.json、资源 JSON 和 assets/<sha256>.webp。`,
  "resource-package.archive.root.missing": () =>
    "资源包缺少根 package.json，可能不是 .pbres 文件，或封包时漏掉了包信息。",
  "resource-package.archive.root.invalid-json": () =>
    "资源包的 package.json 不是合法 JSON。请检查是否多写或漏写了逗号、引号。",
  "resource-package.archive.root.resources-forbidden": () =>
    "package.json 里不应包含 resources 字段；资源要作为独立 JSON 文件放在包内。",
  "resource-package.archive.resource.invalid-json": () =>
    "资源包里的某个资源 JSON 不是合法 JSON。请检查是否多写或漏写了逗号、引号；出错文件见下方路径。",
  "resource-package.archive.resource.path-forbidden": () =>
    "资源 JSON 里不应包含 path 字段，资源在包内的位置由文件名决定。",
  "resource-package.archive.empty-directories.mismatch": () =>
    "package.json 里的 emptyDirectories 与包内实际空目录不一致。",
  "resource-package.archive.media.orphan": (params) =>
    `包内有一张图片没有被任何资源引用，会被忽略${inParentheses(params.assetId)}。`,

  // 文件格式字段
  "contract.schema.additional-property": (params) =>
    `文件包含当前格式不支持的字段${when(params.property, (property) => `：${property}`)}。请检查字段名拼写，或确认文件格式版本是否受支持。`,
  "contract.schema.required": (params) =>
    `文件缺少必需字段${withSpace(params.property)}。`,
  "contract.schema.type": (params) =>
    `字段类型不符合文件格式${when(params.expected, (expected) => `，应为 ${expected}`)}。`,
  "contract.schema.const": (params) =>
    `字段取值不符合固定值${inParentheses(params.expected)}。`,
  "contract.schema.min-length": (params) =>
    `字段内容过短${when(params.limit, (limit) => `，至少需要 ${limit} 个字符`)}。`,
  "contract.schema.invalid": (params) =>
    `字段不符合文件格式${inParentheses(params.keyword)}。`,

  // 卡牌模板
  "template.replacement.unsupported": (params) =>
    `资源使用了该卡牌模板不支持的替换项${withSpace(params.replacementId)}。请检查替换项是否属于这张卡牌的模板。`,
  "template.data.invalid": () =>
    "资源字段不符合所属卡牌模板的格式。请对照模板检查必填项与字段类型。",
  "template.publication.not-allowed": () =>
    "这张卡牌模板尚未开放正式发布。请等平台开放该模板，或改用已开放的模板后再发布。",

  // 发布产物
  "publication.media.invalid": () =>
    "资源包里有读不出尺寸的图片。卡图必须是可解码的 WebP，发布封面还必须是 630×880；图片本身可以随时替换，宽高会按实际像素更新。",
  "publication.fork-source.snapshot-mismatch": () =>
    "Fork 来源记录与上游资源包的快照不一致。请回到资源市场重新 Fork 后再改。",
  "publication.fork-source.resource-mismatch": () =>
    "Fork 来源记录里的资源在上游版本中不存在。请回到资源市场重新 Fork 后再改。",
};

export const creatorDiagnosticCodes: readonly string[] = Object.keys(creatorDiagnosticMessages);

export type PublicationFieldError = {
  path: string;
  code: string;
  message: string;
};

export function collapsePublicationFieldErrors(
  errors: readonly PublicationFieldError[],
): Array<PublicationFieldError & { count: number }> {
  const collapsed = new Map<string, PublicationFieldError & { count: number }>();
  for (const error of errors) {
    const key = `${error.code}\u0000${error.message}`;
    const existing = collapsed.get(key);
    if (existing) existing.count += 1;
    else collapsed.set(key, { ...error, count: 1 });
  }
  return [...collapsed.values()];
}

export function publicationSuccessMessage(
  packageName: string,
  outcome: { created: boolean; idempotent: boolean },
): string {
  if (outcome.idempotent) return `发布内容与已有“${packageName}”完全一致，已跳过`;
  if (outcome.created) return `已发布“${packageName}”`;
  return `已更新已有的“${packageName}”`;
}

export function publicationErrorMessage(code: string, fallback?: string): string {
  return publicationMessages[code] ?? fallback ?? "发布失败，请检查资源包后重试。";
}

/** 这些 code 的 message 由服务端按具体原因生成（例如最低版本号），比本地文案具体。 */
const serverDetailedCodes = new Set(["PUBLICATION_VERSION_CONFLICT"]);

export function creatorDiagnosticMessage(
  code: string,
  fallback?: string,
  params: DiagnosticParams = {},
): string {
  const describe = creatorDiagnosticMessages[code];
  if (describe) return describe(params);
  if (fallback && fallback !== code && serverDetailedCodes.has(code)) return fallback;
  return publicationMessages[code]
    ?? fallback
    ?? `资源包未通过校验（${code}），请检查内容后重试。`;
}

export function collapseCreatorDiagnostics(
  diagnostics: readonly ContractDiagnostic[],
): ContractDiagnostic[] {
  const collapsed = new Map<string, ContractDiagnostic>();
  for (const diagnostic of diagnostics) {
    const fallback = typeof diagnostic.params.message === "string"
      ? diagnostic.params.message
      : "";
    const key = `${diagnostic.code}\u0000${fallback}`;
    const existing = collapsed.get(key);
    if (existing) {
      existing.params.count = Number(existing.params.count ?? 1) + 1;
      continue;
    }
    collapsed.set(key, {
      ...diagnostic,
      params: { ...diagnostic.params, count: 1 },
    });
  }
  return [...collapsed.values()];
}
