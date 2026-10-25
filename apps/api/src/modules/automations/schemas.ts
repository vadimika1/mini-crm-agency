import { DealStatus, LeadStatus } from "@prisma/client";
import { z } from "zod";

export const runAutomationEventSchema = z.object({
  event: z.enum(["lead.stage_changed", "lead.brief_completed", "deal.closed_won", "deal.closed_lost", "lead.created"]),
  leadId: z.number().int().positive().optional(),
  dealId: z.number().int().positive().optional(),
  actorUserId: z.number().int().positive().optional(),
  payload: z
    .object({
      fromStageCode: z.string().min(1).optional(),
      toStageCode: z.string().min(1).optional(),
      leadStatus: z.nativeEnum(LeadStatus).optional(),
      dealStatus: z.nativeEnum(DealStatus).optional(),
      sourceCode: z.string().min(1).optional()
    })
    .optional()
});

export type RunAutomationEventInput = z.infer<typeof runAutomationEventSchema>;
