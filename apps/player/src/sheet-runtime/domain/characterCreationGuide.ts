import { z } from "zod";

export const guideTargetSchema = z.discriminatedUnion("类型", [
  z.object({
    类型: z.literal("module"),
    模块ID: z.string().min(1),
  }),
  z.object({
    类型: z.literal("page"),
    页面ID: z.string().min(1),
  }),
  z.object({
    类型: z.literal("region"),
    区域ID: z.string().min(1),
  }),
]);

export const guideStepSchema = z.object({
  ID: z.string().min(1),
  标题: z.string().min(1),
  说明: z.string().min(1),
  目标: guideTargetSchema.optional(),
});

export const characterCreationGuideSchema = z.object({
  步骤: z.array(guideStepSchema).min(1),
});

export type GuideTarget = z.infer<typeof guideTargetSchema>;
export type GuideStep = z.infer<typeof guideStepSchema>;
export type CharacterCreationGuide = z.infer<typeof characterCreationGuideSchema>;

export interface GuideSession {
  stepIndex: number;
}

export function startGuideSession(): GuideSession {
  return { stepIndex: 0 };
}

export function previousGuideStep(session: GuideSession): GuideSession {
  return { stepIndex: Math.max(0, session.stepIndex - 1) };
}

export function nextGuideStep(session: GuideSession, stepCount: number): GuideSession {
  return { stepIndex: Math.min(Math.max(0, stepCount - 1), session.stepIndex + 1) };
}
