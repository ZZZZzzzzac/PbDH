export const rendererLabHosts = [
  { id: "creator", label: "Creator 预览", scale: 1, shellClass: "host-creator" },
  { id: "player", label: "Player 资源库", scale: 0.82, shellClass: "host-player" },
  { id: "gm", label: "GM Tabletop", scale: 0.68, shellClass: "host-gm" },
  { id: "market", label: "Market 详情", scale: 0.9, shellClass: "host-market" },
] as const;

export type RendererLabScenario = "default" | "tabletop" | "gm-private" | "media-error";
