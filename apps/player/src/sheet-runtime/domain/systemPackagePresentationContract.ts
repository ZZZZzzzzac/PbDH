export const systemPackageCssRestrictions = [
  { syntax: "@import", behavior: "禁止；产生 CSS_TEMPLATE_IMPORT_FORBIDDEN。" },
  { syntax: "@font-face", behavior: "禁止；产生 CSS_TEMPLATE_FONT_FACE_FORBIDDEN。System Package 不捆绑字体。" },
  { syntax: "url(http:…), url(https:…), url(//…), url(/…)", behavior: "禁止外部或站点根资源；产生 CSS_TEMPLATE_EXTERNAL_RESOURCE。" },
  { syntax: "url(assets/…)", behavior: "允许；按包根路径解析并由包资产作用域提供。" },
] as const;

export const stableSystemPackageCssVariableDefinitions = [
  { name: "--restricted-markdown-red", defaultValue: "#a8443e", purpose: "受限 Markdown :red[…] 文字色。" },
  { name: "--restricted-markdown-orange", defaultValue: "#a35f24", purpose: "受限 Markdown :orange[…] 文字色。" },
  { name: "--restricted-markdown-yellow", defaultValue: "#8a741f", purpose: "受限 Markdown :yellow[…] 文字色。" },
  { name: "--restricted-markdown-green", defaultValue: "#39704f", purpose: "受限 Markdown :green[…] 文字色。" },
  { name: "--restricted-markdown-blue", defaultValue: "#356a83", purpose: "受限 Markdown :blue[…] 文字色。" },
  { name: "--restricted-markdown-purple", defaultValue: "#71558a", purpose: "受限 Markdown :purple[…] 文字色。" },
  { name: "--restricted-markdown-gray", defaultValue: "#667074", purpose: "受限 Markdown :gray[…] 文字色。" },
  { name: "--card-table-print-page-padding", defaultValue: "3mm", purpose: "包含 Card Table 的打印页和 HTML Snapshot 内容 inset。" },
] as const;

export const stableSystemPackageCssVariables = stableSystemPackageCssVariableDefinitions.map(({ name }) => name);

export const stableSystemPackageDataAttributes = [
  "data-module-id",
  "data-module-type",
  "data-part",
  "data-guide-region-id",
  "data-print-page",
  "data-template-page-id",
] as const;

export const stableModuleDataParts = {
  freeText: ["container", "label", "input"],
  longText: ["container", "label", "input"],
  checkboxResource: ["container", "label", "options", "option", "option-group", "option-label", "input"],
  countableResource: ["container", "label", "counter", "decrement-button", "increment-button", "value-group", "maximum", "maximum-input", "marker-group", "marker", "marker-image", "current-markers", "remaining-markers"],
  readOnlyDisplay: ["container", "label", "value", "image", "image-fallback"],
  imageField: ["container", "label", "surface", "input", "image", "image-fallback", "remove-button"],
  resourcePicker: ["container", "button"],
  resourceComposer: ["container", "button"],
  cardTable: ["container", "surface", "actions", "indicator-column", "indicator"],
} as const;

export const stableSystemPackageDataParts = [...new Set(Object.values(stableModuleDataParts).flat())].sort();

export const unstablePresentationDetails = [
  "Framework-owned toolbar, dialog and menu DOM/classes",
  "CSS classes not explicitly listed in the generated presentation contract",
  "data-part values not listed in stableSystemPackageDataParts",
  "inline style implementation variables such as --play-card-width and --play-card-state-color",
] as const;
