import { clampInt } from "../utils";

export type CountableState = { current: number; max: number | null };
export type CountableDirection = "decrement" | "increment";
export type CountableTarget = "current" | "maximum";

export interface CountableTransitionConfig {
  min: number;
  step: number;
  editableMax: boolean;
}

export function transitionCountableState(
  state: CountableState,
  config: CountableTransitionConfig,
  target: CountableTarget,
  direction: CountableDirection,
): CountableState {
  const delta = direction === "increment" ? config.step : -config.step;
  if (target === "current") {
    return { ...state, current: clampInt(state.current + delta, config.min, state.max) };
  }
  if (!config.editableMax || state.max === null) return state;

  const max = Math.max(config.min, state.max + delta);
  return { current: clampInt(state.current, config.min, max), max };
}

export function canTransitionCountableState(
  state: CountableState,
  config: CountableTransitionConfig,
  target: CountableTarget,
  direction: CountableDirection,
): boolean {
  const next = transitionCountableState(state, config, target, direction);
  return next.current !== state.current || next.max !== state.max;
}
