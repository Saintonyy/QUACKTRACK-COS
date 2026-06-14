import type {
  BroadcastObjectId,
  CampaignId,
  CorrelationId,
  DurationMs,
  EventId,
  ISODateTime,
  OperatorId,
  SponsorId,
  VersionString
} from '@quacktrack/core';
import type { EventName, EventNamespace, EventSource, EventSourceType, PermissionContext } from '@quacktrack/events';

export const BROADCAST_OBJECT_TYPES = [
  'player',
  'coach',
  'interview',
  'stat',
  'breaking',
  'weather',
  'injury',
  'replay',
  'sponsor',
  'playerOfTheGame',
  'compound'
] as const;

export type BroadcastObjectType = (typeof BROADCAST_OBJECT_TYPES)[number];

export const BROADCAST_OBJECT_FAMILIES = [
  'Person Context',
  'Performance Context',
  'Game Context',
  'Commercial Context',
  'Runtime Context'
] as const;

export type BroadcastObjectFamily = (typeof BROADCAST_OBJECT_FAMILIES)[number];

export const BROADCAST_PRIORITIES = ['critical', 'high', 'normal', 'low'] as const;

export type BroadcastPriority = (typeof BROADCAST_PRIORITIES)[number];

export const DENSITIES = ['compact', 'standard', 'expanded'] as const;

export type Density = (typeof DENSITIES)[number];

export const BROADCAST_OBJECT_LIFECYCLES = [
  'CREATED',
  'VALIDATED',
  'QUEUED',
  'SCHEDULED',
  'ENTERING',
  'VISIBLE',
  'UPDATING',
  'EXITING',
  'COMPLETED',
  'ARCHIVED',
  'REJECTED',
  'INTERRUPTED',
  'EXPIRED'
] as const;

export type BroadcastObjectLifecycle = (typeof BROADCAST_OBJECT_LIFECYCLES)[number];

export interface Metric {
  value: string | number;
  label: string;
  unit?: string;
  role?: string;
  trend?: 'up' | 'down' | 'flat' | 'none';
}

export interface PlayerPayload {
  playerId?: string;
  playerName: string;
  number?: string | number;
  position?: string;
  team: string;
  teamAbbreviation?: string;
  headline?: string;
  metrics?: Metric[];
  status?: string;
}

export interface CoachPayload {
  coachId?: string;
  coachName: string;
  role: string;
  team?: string;
  teamAbbreviation?: string;
  segment?: string;
  note?: string;
}

export interface InterviewPayload {
  subjectId?: string;
  subjectName: string;
  subjectRole?: string;
  team?: string;
  segmentLabel: string;
  segmentPhase?: string;
  interviewerName?: string;
  isLive?: boolean;
}

export interface StatPayload {
  statId?: string;
  subjectType?: 'player' | 'team' | 'game' | 'league';
  subjectId?: string;
  subjectName?: string;
  statCategory?: string;
  primaryMetric: Metric;
  secondaryMetrics?: Metric[];
  source?: string;
  isOfficial?: boolean;
  confidence?: number;
  timestamp?: ISODateTime;
}

export interface BreakingPayload {
  headline: string;
  detail?: string;
  status?: string;
  severity?: 'info' | 'watch' | 'warning' | 'critical';
  relatedTeam?: string;
  relatedPlayer?: string;
  source?: string;
  manualHold?: boolean;
}

export interface WeatherPayload {
  headline: string;
  severity: 'watch' | 'warning' | 'critical';
  detail?: string;
  source?: string;
  manualHold?: boolean;
}

export interface InjuryPayload {
  headline: string;
  relatedPlayer?: string;
  relatedTeam?: string;
  status?: string;
  source?: string;
  manualHold?: boolean;
}

export interface ReplayPayload {
  replayId?: string;
  replayLabel: string;
  momentDescription: string;
  relatedPlay?: string;
  relatedPlayer?: string;
  relatedTeam?: string;
  relatedStat?: Metric;
  angleLabel?: string;
  source?: string;
}

export interface SponsorPayload {
  sponsorId?: SponsorId;
  sponsorName: string;
  sponsorSlot: string;
  campaignId?: CampaignId;
  category?: string;
  logoPath?: string;
  presentationLabel?: string;
  message?: string;
  callToAction?: string;
  requiredDuration?: DurationMs;
  fulfillmentId?: string;
}

export interface PlayerOfTheGamePayload {
  playerId?: string;
  playerName: string;
  team: string;
  number?: string | number;
  position?: string;
  metrics?: Metric[];
  sponsor?: SponsorAttachment;
  awardLabel?: string;
}

export const COMPOSITION_TYPES = [
  'parent_child',
  'sequential',
  'stacked',
  'sponsored',
  'replay_compound',
  'player_of_the_game',
  'touchdown_sequence'
] as const;

export type CompositionType = (typeof COMPOSITION_TYPES)[number];

export const REQUEUE_POLICIES = ['never', 'if_relevant', 'after_parent', 'operator_only', 'reschedule'] as const;

export type RequeuePolicy = (typeof REQUEUE_POLICIES)[number];

export interface CompoundPayload {
  parentObjectId: BroadcastObjectId;
  childObjectIds?: BroadcastObjectId[];
  childPayloads?: BroadcastObjectPayload[];
  compositionType: CompositionType;
  analyticsGroupId?: string;
  requeuePolicy?: RequeuePolicy;
}

export type BroadcastObjectPayload =
  | PlayerPayload
  | CoachPayload
  | InterviewPayload
  | StatPayload
  | BreakingPayload
  | WeatherPayload
  | InjuryPayload
  | ReplayPayload
  | SponsorPayload
  | PlayerOfTheGamePayload
  | CompoundPayload;

export const SPONSOR_POLICIES = ['permitted', 'conditional', 'suppressed', 'required', 'fallback'] as const;

export type SponsorPolicy = (typeof SPONSOR_POLICIES)[number];

export const SPONSOR_FULFILLMENT_STATUSES = [
  'pending',
  'fulfilled',
  'interrupted',
  'missed',
  'rescheduled',
  'suppressed',
  'not_required'
] as const;

export type SponsorFulfillmentStatus = (typeof SPONSOR_FULFILLMENT_STATUSES)[number];

export const SPONSOR_DISPLAY_MODES = [
  'none',
  'logo',
  'text',
  'lockup',
  'lower_third',
  'bug',
  'fallback_text'
] as const;

export type SponsorDisplayMode = (typeof SPONSOR_DISPLAY_MODES)[number];

export interface SponsorAttachment {
  sponsorId: SponsorId;
  sponsorName: string;
  sponsorSlot: string;
  campaignId?: CampaignId;
  displayMode: SponsorDisplayMode;
  logoPath?: string;
  presentationLabel?: string;
  requiredDuration?: DurationMs;
  policy: SponsorPolicy;
  fulfillmentStatus: SponsorFulfillmentStatus;
}

export interface AnalyticsMetadata {
  impressions: number;
  displayTime: DurationMs;
  firstShownAt?: ISODateTime;
  lastHiddenAt?: ISODateTime;
  completionStatus?: 'pending' | 'completed' | 'interrupted' | 'expired' | 'rejected';
  interruptionCount: number;
  interruptionReason?: string;
  queueWaitTime?: DurationMs;
  expirationStatus?: 'active' | 'expired' | 'not_applicable';
  sponsorFulfillmentStatus?: SponsorFulfillmentStatus;
  operatorSource?: EventSource;
}

export interface LayoutMetadata {
  requestedZone?: 'Zone A' | 'Zone B' | 'Zone C' | 'Zone D' | 'Zone E' | 'Zone F';
  resolvedZone?: 'Zone A' | 'Zone B' | 'Zone C' | 'Zone D' | 'Zone E' | 'Zone F';
  safeAreaPolicy?: 'clear' | 'near' | 'blocked' | 'override_requested' | 'override_rejected';
  density?: Density;
  collisionPolicy?: 'replace' | 'stack' | 'queue' | 'reject' | 'compact' | 'relocate';
  scorebugProtected?: boolean;
}

export interface TimingMetadata {
  duration?: DurationMs;
  autoHide?: boolean;
  expiresAt?: ISODateTime;
  scheduledFor?: ISODateTime;
  scheduleWindowStart?: ISODateTime;
  scheduleWindowEnd?: ISODateTime;
  manualHold?: boolean;
}

export interface SourceMetadata {
  eventId: EventId;
  eventName: EventName;
  eventNamespace?: EventNamespace;
  source: EventSource;
  sourceType: EventSourceType;
  operatorId?: OperatorId;
  timestamp: ISODateTime;
}

export interface BroadcastObject<TPayload extends BroadcastObjectPayload = BroadcastObjectPayload> {
  id: BroadcastObjectId;
  objectVersion: number;
  schemaVersion: VersionString;
  type: BroadcastObjectType;
  family: BroadcastObjectFamily;
  lifecycle: BroadcastObjectLifecycle;
  priority: BroadcastPriority;
  payload: TPayload;
  sponsor?: SponsorAttachment | null;
  permissions?: PermissionContext;
  analytics: AnalyticsMetadata;
  layout?: LayoutMetadata;
  density?: Density;
  timing?: TimingMetadata;
  source: SourceMetadata;
  correlationId?: CorrelationId;
  createdAt: ISODateTime;
  validatedAt?: ISODateTime;
  queuedAt?: ISODateTime;
  scheduledAt?: ISODateTime;
  shownAt?: ISODateTime;
  updatedAt?: ISODateTime;
  completedAt?: ISODateTime;
  archivedAt?: ISODateTime;
}

export type PlayerBroadcastObject = BroadcastObject<PlayerPayload> & {
  type: 'player';
  family: 'Person Context';
};

export type CoachBroadcastObject = BroadcastObject<CoachPayload> & {
  type: 'coach';
  family: 'Person Context';
};

export type InterviewBroadcastObject = BroadcastObject<InterviewPayload> & {
  type: 'interview';
  family: 'Person Context';
};

export type StatBroadcastObject = BroadcastObject<StatPayload> & {
  type: 'stat';
  family: 'Performance Context';
};

export type BreakingBroadcastObject = BroadcastObject<BreakingPayload> & {
  type: 'breaking';
  family: 'Game Context';
};

export type WeatherBroadcastObject = BroadcastObject<WeatherPayload> & {
  type: 'weather';
  family: 'Game Context';
};

export type InjuryBroadcastObject = BroadcastObject<InjuryPayload> & {
  type: 'injury';
  family: 'Game Context';
};

export type ReplayBroadcastObject = BroadcastObject<ReplayPayload> & {
  type: 'replay';
  family: 'Game Context';
};

export type SponsorBroadcastObject = BroadcastObject<SponsorPayload> & {
  type: 'sponsor';
  family: 'Commercial Context';
};

export type PlayerOfTheGameBroadcastObject = BroadcastObject<PlayerOfTheGamePayload> & {
  type: 'playerOfTheGame';
};

export type CompoundBroadcastObject = BroadcastObject<CompoundPayload> & {
  type: 'compound';
};

export type AnyBroadcastObject =
  | PlayerBroadcastObject
  | CoachBroadcastObject
  | InterviewBroadcastObject
  | StatBroadcastObject
  | BreakingBroadcastObject
  | WeatherBroadcastObject
  | InjuryBroadcastObject
  | ReplayBroadcastObject
  | SponsorBroadcastObject
  | PlayerOfTheGameBroadcastObject
  | CompoundBroadcastObject;
