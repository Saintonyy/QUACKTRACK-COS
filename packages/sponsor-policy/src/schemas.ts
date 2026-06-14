import {
  ISODateTimeSchema,
  campaignIdSchema,
  durationMsSchema,
  sponsorIdSchema,
  validateWithSchema
} from '@quacktrack/core';
import {
  broadcastObjectSchema,
  broadcastObjectTypeSchema,
  sponsorAttachmentSchema,
  sponsorDisplayModeSchema,
  sponsorFulfillmentStatusSchema,
  sponsorPolicySchema,
  type BroadcastObject,
  type BroadcastObjectType,
  type SponsorAttachment,
  type SponsorFulfillmentStatus,
  type SponsorPayload,
  type SponsorPolicy
} from '@quacktrack/objects';
import { z } from 'zod';

import {
  SPONSOR_FULFILLMENT_ACTIONS,
  SPONSOR_SUPPRESSION_REASONS,
  type SponsorConfig,
  type SponsorConfigSponsor,
  type SponsorFulfillmentAction,
  type SponsorFulfillmentTransition,
  type SponsorPolicyDecision,
  type SponsorPolicyInput,
  type SponsorPolicySceneType,
  type SponsorSuppressionReason
} from './types';

const sceneTypeSchema: z.ZodType<SponsorPolicySceneType> = z.enum([
  'live_game',
  'replay',
  'interview',
  'halftime',
  'starting_soon',
  'postgame',
  'emergency'
]);

const defaultPolicyByObjectType: Record<BroadcastObjectType, SponsorPolicy> = {
  player: 'permitted',
  coach: 'conditional',
  interview: 'permitted',
  stat: 'permitted',
  breaking: 'conditional',
  weather: 'suppressed',
  injury: 'suppressed',
  replay: 'permitted',
  sponsor: 'required',
  playerOfTheGame: 'permitted',
  compound: 'conditional'
};

export const sponsorConfigSponsorSchema: z.ZodType<SponsorConfigSponsor> = z.object({
  sponsorId: sponsorIdSchema,
  sponsorName: z.string().min(1),
  sponsorSlot: z.string().min(1),
  campaignId: campaignIdSchema.optional(),
  displayMode: sponsorDisplayModeSchema.optional(),
  logoPath: z.string().min(1).optional(),
  textFallback: z.string().min(1).optional(),
  requiredDuration: durationMsSchema.optional()
}) as unknown as z.ZodType<SponsorConfigSponsor>;

export const sponsorConfigCampaignSchema = z.object({
  campaignId: campaignIdSchema,
  sponsorId: sponsorIdSchema,
  requiredDuration: durationMsSchema.optional(),
  active: z.boolean().optional()
});

export const sponsorConfigSchema: z.ZodType<SponsorConfig> = z.object({
  configVersion: z.string().min(1),
  enabled: z.boolean().optional(),
  defaultDisplayMode: sponsorDisplayModeSchema.optional(),
  requireLogoForDisplay: z.boolean().optional(),
  policyByObjectType: z.record(broadcastObjectTypeSchema, sponsorPolicySchema).optional(),
  sensitiveObjectTypes: z.array(broadcastObjectTypeSchema).optional(),
  sponsors: z.array(sponsorConfigSponsorSchema),
  campaigns: z.array(sponsorConfigCampaignSchema)
}) as unknown as z.ZodType<SponsorConfig>;

export const sponsorPolicyInputSchema: z.ZodType<SponsorPolicyInput> = z.object({
  object: broadcastObjectSchema,
  config: sponsorConfigSchema,
  sceneType: sceneTypeSchema.optional(),
  sponsorId: sponsorIdSchema.optional(),
  campaignId: campaignIdSchema.optional(),
  sensitive: z.boolean().optional()
}) as unknown as z.ZodType<SponsorPolicyInput>;

export const sponsorPolicyDecisionSchema: z.ZodType<SponsorPolicyDecision> = z.object({
  policy: sponsorPolicySchema,
  allowed: z.boolean(),
  required: z.boolean(),
  displayMode: sponsorDisplayModeSchema,
  sponsor: sponsorAttachmentSchema.optional(),
  sponsorId: sponsorIdSchema.optional(),
  campaignId: campaignIdSchema.optional(),
  sponsorName: z.string().min(1).optional(),
  sponsorSlot: z.string().min(1).optional(),
  fallbackText: z.string().min(1).optional(),
  requiredDuration: durationMsSchema.optional(),
  suppressionReasons: z.array(z.enum(SPONSOR_SUPPRESSION_REASONS))
}) as unknown as z.ZodType<SponsorPolicyDecision>;

export const sponsorFulfillmentActionSchema: z.ZodType<SponsorFulfillmentAction> =
  z.enum(SPONSOR_FULFILLMENT_ACTIONS);

export const sponsorFulfillmentTransitionSchema: z.ZodType<SponsorFulfillmentTransition> = z.object({
  from: sponsorFulfillmentStatusSchema,
  action: sponsorFulfillmentActionSchema,
  timestamp: ISODateTimeSchema,
  rescheduledFor: ISODateTimeSchema.optional(),
  reason: z.string().min(1).optional()
}) as unknown as z.ZodType<SponsorFulfillmentTransition>;

export function validateSponsorConfig(input: unknown) {
  return validateWithSchema(sponsorConfigSchema, input);
}

export function evaluateSponsorPolicy(input: SponsorPolicyInput): SponsorPolicyDecision {
  const object = input.object;
  const config = input.config;
  const configuredPolicy = config.policyByObjectType?.[object.type];
  let policy = configuredPolicy ?? defaultPolicyByObjectType[object.type] ?? 'suppressed';
  const suppressionReasons: SponsorSuppressionReason[] = [];

  if (config.enabled === false) {
    policy = 'suppressed';
    suppressionReasons.push('config_disallows_sponsor');
  }

  if (object.type === 'weather') {
    policy = 'suppressed';
    suppressionReasons.push('weather_safety_context');
  }

  if (object.type === 'injury') {
    policy = 'suppressed';
    suppressionReasons.push('injury_sensitive_context');
  }

  if (input.sceneType === 'emergency' && object.type !== 'sponsor') {
    policy = 'suppressed';
    suppressionReasons.push('emergency_scene');
  }

  if (input.sensitive || config.sensitiveObjectTypes?.includes(object.type)) {
    policy = 'suppressed';
    suppressionReasons.push('sensitive_context');
  }

  const sponsorRecord = resolveSponsorRecord(input);
  const sponsorIdentity = getSponsorIdentity(object, sponsorRecord);

  if (policy === 'required' && sponsorIdentity === undefined) {
    suppressionReasons.push('missing_sponsor_identity');
  }

  const displayMode = sponsorRecord?.displayMode ?? config.defaultDisplayMode ?? 'logo';
  const requiresLogo = config.requireLogoForDisplay === true || displayMode === 'logo' || displayMode === 'lockup';
  const fallbackText = sponsorRecord?.textFallback;

  if (policy !== 'suppressed' && requiresLogo && sponsorRecord !== undefined && sponsorRecord.logoPath === undefined) {
    if (fallbackText !== undefined) {
      policy = 'fallback';
    } else if (policy === 'required') {
      policy = 'suppressed';
      suppressionReasons.push('missing_required_logo');
    }
  }

  const allowed = policy !== 'suppressed' && !(policy === 'required' && sponsorIdentity === undefined);
  const required = policy === 'required';

  const decision: SponsorPolicyDecision = {
    policy,
    allowed,
    required,
    displayMode: policy === 'fallback' ? 'fallback_text' : displayMode,
    suppressionReasons: [...new Set(suppressionReasons)]
  };

  if (sponsorIdentity !== undefined) {
    decision.sponsorId = sponsorIdentity.sponsorId;
    decision.sponsorName = sponsorIdentity.sponsorName;
    decision.sponsorSlot = sponsorIdentity.sponsorSlot;

    if (sponsorIdentity.campaignId !== undefined) {
      decision.campaignId = sponsorIdentity.campaignId;
    }
  }

  if (fallbackText !== undefined) {
    decision.fallbackText = fallbackText;
  }

  if (sponsorRecord?.requiredDuration !== undefined) {
    decision.requiredDuration = sponsorRecord.requiredDuration;
  }

  return decision;
}

export function resolveSponsorAttachment(input: SponsorPolicyInput): SponsorAttachment | null {
  const decision = evaluateSponsorPolicy(input);

  if (!decision.allowed || decision.sponsorId === undefined || decision.sponsorName === undefined || decision.sponsorSlot === undefined) {
    return null;
  }

  const attachment: SponsorAttachment = {
    sponsorId: decision.sponsorId,
    sponsorName: decision.sponsorName,
    sponsorSlot: decision.sponsorSlot,
    displayMode: decision.displayMode,
    policy: decision.policy,
    fulfillmentStatus: 'pending'
  };

  if (decision.campaignId !== undefined) {
    attachment.campaignId = decision.campaignId;
  }

  if (decision.requiredDuration !== undefined) {
    attachment.requiredDuration = decision.requiredDuration;
  }

  return attachment;
}

export function transitionSponsorFulfillment(
  current: SponsorFulfillmentStatus | Pick<SponsorAttachment, 'fulfillmentStatus'>,
  transition: SponsorFulfillmentTransition
): SponsorFulfillmentStatus {
  const currentStatus = typeof current === 'string' ? current : current.fulfillmentStatus;

  if (currentStatus !== transition.from) {
    return currentStatus;
  }

  switch (transition.action) {
    case 'fulfill':
      return 'fulfilled';
    case 'interrupt':
      return 'interrupted';
    case 'reschedule':
      return 'rescheduled';
    case 'miss':
      return 'missed';
    case 'suppress':
      return 'suppressed';
    case 'reset':
      return 'pending';
  }
}

function resolveSponsorRecord(input: SponsorPolicyInput): SponsorConfigSponsor | undefined {
  const sponsorPayload = input.object.type === 'sponsor' ? (input.object.payload as SponsorPayload) : undefined;
  const sponsorId = input.sponsorId ?? input.object.sponsor?.sponsorId ?? sponsorPayload?.sponsorId;
  const campaignId = input.campaignId ?? input.object.sponsor?.campaignId ?? sponsorPayload?.campaignId;

  return (
    input.config.sponsors.find((sponsor) => sponsorId !== undefined && sponsor.sponsorId === sponsorId) ??
    input.config.sponsors.find((sponsor) => campaignId !== undefined && sponsor.campaignId === campaignId) ??
    input.config.sponsors[0]
  );
}

function getSponsorIdentity(
  object: BroadcastObject,
  sponsorRecord: SponsorConfigSponsor | undefined
):
  | {
      sponsorId: SponsorAttachment['sponsorId'];
      campaignId?: SponsorAttachment['campaignId'];
      sponsorName: string;
      sponsorSlot: string;
    }
  | undefined {
  if (object.sponsor !== undefined && object.sponsor !== null) {
    const identity = {
      sponsorId: object.sponsor.sponsorId,
      sponsorName: object.sponsor.sponsorName,
      sponsorSlot: object.sponsor.sponsorSlot
    };

    return object.sponsor.campaignId === undefined
      ? identity
      : {
          ...identity,
          campaignId: object.sponsor.campaignId
        };
  }

  if (object.type === 'sponsor') {
    const payload = object.payload as SponsorPayload;
    const sponsorId = payload.sponsorId ?? sponsorRecord?.sponsorId;

    if (sponsorId === undefined || payload.sponsorName.length === 0 || payload.sponsorSlot.length === 0) {
      return undefined;
    }

    const identity = {
      sponsorId,
      sponsorName: payload.sponsorName,
      sponsorSlot: payload.sponsorSlot
    };

    const campaignId = payload.campaignId ?? sponsorRecord?.campaignId;

    return campaignId === undefined
      ? identity
      : {
          ...identity,
          campaignId
        };
  }

  if (sponsorRecord === undefined) {
    return undefined;
  }

  const identity = {
    sponsorId: sponsorRecord.sponsorId,
    sponsorName: sponsorRecord.sponsorName,
    sponsorSlot: sponsorRecord.sponsorSlot
  };

  return sponsorRecord.campaignId === undefined
    ? identity
    : {
        ...identity,
        campaignId: sponsorRecord.campaignId
      };
}
