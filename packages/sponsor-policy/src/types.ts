import type { CampaignId, DurationMs, ISODateTime, SponsorId } from '@quacktrack/core';
import type {
  BroadcastObject,
  BroadcastObjectType,
  SponsorAttachment,
  SponsorDisplayMode,
  SponsorFulfillmentStatus,
  SponsorPolicy
} from '@quacktrack/objects';

export type SponsorPolicySceneType =
  | 'live_game'
  | 'replay'
  | 'interview'
  | 'halftime'
  | 'starting_soon'
  | 'postgame'
  | 'emergency';

export const SPONSOR_SUPPRESSION_REASONS = [
  'weather_safety_context',
  'injury_sensitive_context',
  'emergency_scene',
  'config_disallows_sponsor',
  'sensitive_context',
  'missing_sponsor_identity',
  'missing_required_logo',
  'unsupported_object_type'
] as const;

export type SponsorSuppressionReason = (typeof SPONSOR_SUPPRESSION_REASONS)[number];

export interface SponsorPolicyInput<TObject extends BroadcastObject = BroadcastObject> {
  object: TObject;
  config: SponsorConfig;
  sceneType?: SponsorPolicySceneType;
  sponsorId?: SponsorId;
  campaignId?: CampaignId;
  sensitive?: boolean;
}

export interface SponsorPolicyDecision {
  policy: SponsorPolicy;
  allowed: boolean;
  required: boolean;
  displayMode: SponsorDisplayMode;
  sponsor?: SponsorAttachment;
  sponsorId?: SponsorId;
  campaignId?: CampaignId;
  sponsorName?: string;
  sponsorSlot?: string;
  fallbackText?: string;
  requiredDuration?: DurationMs;
  suppressionReasons: SponsorSuppressionReason[];
}

export const SPONSOR_FULFILLMENT_ACTIONS = [
  'fulfill',
  'interrupt',
  'reschedule',
  'miss',
  'suppress',
  'reset'
] as const;

export type SponsorFulfillmentAction = (typeof SPONSOR_FULFILLMENT_ACTIONS)[number];

export interface SponsorFulfillmentTransition {
  from: SponsorFulfillmentStatus;
  action: SponsorFulfillmentAction;
  timestamp: ISODateTime;
  rescheduledFor?: ISODateTime;
  reason?: string;
}

export interface SponsorConfigSponsor {
  sponsorId: SponsorId;
  sponsorName: string;
  sponsorSlot: string;
  campaignId?: CampaignId;
  displayMode?: SponsorDisplayMode;
  logoPath?: string;
  textFallback?: string;
  requiredDuration?: DurationMs;
}

export interface SponsorConfigCampaign {
  campaignId: CampaignId;
  sponsorId: SponsorId;
  requiredDuration?: DurationMs;
  active?: boolean;
}

export interface SponsorConfig {
  configVersion: string;
  enabled?: boolean;
  defaultDisplayMode?: SponsorDisplayMode;
  requireLogoForDisplay?: boolean;
  policyByObjectType?: Partial<Record<BroadcastObjectType, SponsorPolicy>>;
  sensitiveObjectTypes?: BroadcastObjectType[];
  sponsors: SponsorConfigSponsor[];
  campaigns: SponsorConfigCampaign[];
}
