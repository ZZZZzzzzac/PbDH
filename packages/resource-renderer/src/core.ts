export type RendererDiagnostic = {
  code: string;
  severity: "error" | "warning" | "info";
  location: string;
  params: Record<string, unknown>;
};

export type ManagedAsset =
  | { status: "ready"; url: string }
  | { status: "loading" }
  | { status: "error"; reason: string };

export type SurfacePresentation = {
  width: string;
  height: string;
  unit: "mm";
  mode: "text" | "split" | "image";
  fixedRatio: boolean;
};

export type SurfaceResource<TData> = {
  template: { id: string; version: string };
  presentation: SurfacePresentation;
  data: TData;
  media: Record<string, string>;
};

export type RendererRevisionCapability<TData, TState, TOutput> = {
  revision: string;
  templateId: string;
  templateVersion: string;
  requiredMediaSlots: readonly string[];
  optionalMediaSlots?: readonly string[];
  defaultState: (data: TData) => TState;
  validateState: (state: unknown) => state is TState;
  styles: string;
  render: (input: {
    data: TData;
    state: TState;
    assets: Readonly<Partial<Record<string, string>>>;
    presentation: SurfacePresentation;
    onStateCommand?: (commandId: string, value: string) => void;
  }) => TOutput;
};

export type SurfaceReady<TData, TState, TOutput> = {
  status: "ready";
  diagnostics: [];
  widthMm: number;
  heightMm: number;
  renderer: RendererRevisionCapability<TData, TState, TOutput>;
  renderInput: {
    data: TData;
    state: TState;
    assets: Readonly<Partial<Record<string, string>>>;
    presentation: SurfacePresentation;
    onStateCommand?: (commandId: string, value: string) => void;
  };
};

export type SurfaceUnavailable = {
  status: "loading" | "error";
  diagnostics: RendererDiagnostic[];
  widthMm: number | null;
  heightMm: number | null;
};

export type SurfacePreparation<TData, TState, TOutput> =
  | SurfaceReady<TData, TState, TOutput>
  | SurfaceUnavailable;

function diagnostic(
  code: string,
  severity: RendererDiagnostic["severity"],
  location: string,
  params: Record<string, unknown> = {},
): RendererDiagnostic {
  return { code, severity, location, params };
}

export class RendererRevisionRegistry<TOutput> {
  readonly #renderers = new Map<string, RendererRevisionCapability<any, any, TOutput>>();

  constructor(renderers: readonly RendererRevisionCapability<any, any, TOutput>[]) {
    for (const renderer of renderers) {
      if (this.#renderers.has(renderer.revision)) {
        throw new Error(`Duplicate Renderer Revision: ${renderer.revision}`);
      }
      this.#renderers.set(renderer.revision, renderer);
    }
  }

  resolve(revision: string): RendererRevisionCapability<any, any, TOutput> | undefined {
    return this.#renderers.get(revision);
  }

  list(): readonly string[] {
    return [...this.#renderers.keys()];
  }
}

export function prepareCanonicalSurface<TData, TState, TOutput>(input: {
  resource: SurfaceResource<TData>;
  expectedRendererRevision: string;
  renderer?: RendererRevisionCapability<TData, TState, TOutput>;
  assets: ReadonlyMap<string, ManagedAsset>;
  state?: unknown;
  onStateCommand?: (commandId: string, value: string) => void;
}): SurfacePreparation<TData, TState, TOutput> {
  const width = Number(input.resource.presentation.width);
  const height = Number(input.resource.presentation.height);
  const widthMm = Number.isFinite(width) && width > 0 ? width : null;
  const heightMm = Number.isFinite(height) && height > 0 ? height : null;
  const diagnostics: RendererDiagnostic[] = [];
  const presentation = input.resource.presentation;
  const validMode = presentation.mode === "text"
    || presentation.mode === "split"
    || presentation.mode === "image";
  if (presentation.unit !== "mm" || widthMm === null || heightMm === null
    || !validMode || typeof presentation.fixedRatio !== "boolean") {
    diagnostics.push(diagnostic(
      "renderer.presentation.invalid",
      "error",
      "/presentation",
      {
        fixedRatio: presentation.fixedRatio,
        height: presentation.height,
        mode: presentation.mode,
        unit: presentation.unit,
        width: presentation.width,
      },
    ));
  }
  if (!input.renderer) {
    diagnostics.push(diagnostic(
      "renderer.revision.unsupported",
      "error",
      "/template",
      { revision: input.expectedRendererRevision },
    ));
    return { status: "error", diagnostics, widthMm, heightMm };
  }
  if (
    input.renderer.revision !== input.expectedRendererRevision
    || input.renderer.templateId !== input.resource.template.id
    || input.renderer.templateVersion !== input.resource.template.version
  ) {
    diagnostics.push(diagnostic(
      "renderer.binding.mismatch",
      "error",
      "/template",
      {
        actualRevision: input.renderer.revision,
        expectedRevision: input.expectedRendererRevision,
        templateId: input.resource.template.id,
        templateVersion: input.resource.template.version,
      },
    ));
  }

  const assetUrls: Record<string, string> = {};
  let loading = false;
  const requiredSlots = new Set(input.renderer.requiredMediaSlots);
  const mediaSlots = [
    ...requiredSlots,
    ...(input.renderer.optionalMediaSlots ?? []).filter((slot) => !requiredSlots.has(slot)),
  ];
  for (const slot of mediaSlots) {
    const assetId = input.resource.media[slot];
    if (!assetId) {
      if (requiredSlots.has(slot)) {
        diagnostics.push(diagnostic(
          "renderer.media.reference-missing",
          "error",
          `/media/${slot}`,
          { slot },
        ));
      }
      continue;
    }
    const asset = input.assets.get(assetId);
    if (!asset) {
      diagnostics.push(diagnostic(
        "renderer.media.asset-missing",
        "error",
        `/media/${slot}`,
        { assetId, slot },
      ));
    } else if (asset.status === "loading") {
      loading = true;
      diagnostics.push(diagnostic(
        "renderer.media.loading",
        "info",
        `/media/${slot}`,
        { assetId, slot },
      ));
    } else if (asset.status === "error") {
      diagnostics.push(diagnostic(
        "renderer.media.decode-failed",
        "error",
        `/media/${slot}`,
        { assetId, reason: asset.reason, slot },
      ));
    } else {
      assetUrls[slot] = asset.url;
    }
  }

  const state = input.state ?? input.renderer.defaultState(input.resource.data);
  if (!input.renderer.validateState(state)) {
    diagnostics.push(diagnostic(
      "renderer.state.invalid",
      "error",
      "/state",
    ));
  }
  if (diagnostics.some((item) => item.severity === "error")) {
    return { status: "error", diagnostics, widthMm, heightMm };
  }
  if (loading) return { status: "loading", diagnostics, widthMm, heightMm };
  return {
    status: "ready",
    diagnostics: [],
    widthMm: widthMm!,
    heightMm: heightMm!,
    renderer: input.renderer,
    renderInput: {
      data: input.resource.data,
      state: state as TState,
      assets: assetUrls,
      presentation,
      ...(input.onStateCommand ? { onStateCommand: input.onStateCommand } : {}),
    },
  };
}
