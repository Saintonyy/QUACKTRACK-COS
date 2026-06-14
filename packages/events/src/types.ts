import type {
  BroadcastObjectId,
  CorrelationId,
  DurationMs,
  EventId,
  ISODateTime,
  OperatorId,
  ValidationIssue
} from '@quacktrack/core';

export const KNOWN_EVENT_NAMES = [
  'COS_SHOW',
  'COS_HIDE',
  'COS_UPDATE',
  'COS_CLEAR',
  'TOUCHDOWN_CONTEXT',
  'PLAYER_INTRODUCTION',
  'PLAYER_STAT',
  'COACH_CONTEXT',
  'COACH_INTERVIEW',
  'HALFTIME_INTERVIEW',
  'BREAKING_UPDATE',
  'WEATHER_ALERT',
  'INJURY_UPDATE',
  'REPLAY_CONTEXT',
  'REPLAY_COMPOUND_CONTEXT',
  'SPONSOR_MOMENT',
  'PLAYER_OF_THE_GAME',
  'QUEUE_ADD',
  'QUEUE_REMOVE',
  'QUEUE_NEXT',
  'QUEUE_CLEAR',
  'OBJECT_ARCHIVE',
  'SPONSOR_SUPPRESS',
  'LAYOUT_RESOLVE',
  'ANALYTICS_RECORD',
  'CONFIG_RELOAD',
  'EMERGENCY_CLEAR'
] as const;

export type KnownEventName = (typeof KNOWN_EVENT_NAMES)[number];

export const EVENT_NAMESPACES = ['context', 'runtime', 'sponsor', 'replay', 'league'] as const;

export type EventNamespace = (typeof EVENT_NAMESPACES)[number];
export type NamespacedEventName = `${EventNamespace}.${string}`;
export type EventName = KnownEventName | NamespacedEventName;

export const EVENT_SOURCES = [
  'system',
  'operator_panel',
  'hotkey',
  'preset',
  'remote',
  'api',
  'ai',
  'scheduler',
  'queue_engine',
  'layout_engine',
  'analytics_layer',
  'sponsor_policy',
  'state_manager'
] as const;

export type EventSource = (typeof EVENT_SOURCES)[number];

export const EVENT_SOURCE_TYPES = [
  'human',
  'system',
  'automation',
  'remote',
  'replay',
  'sponsor_scheduler',
  'ai'
] as const;

export type EventSourceType = (typeof EVENT_SOURCE_TYPES)[number];

export const QUEUE_BEHAVIORS = [
  'showNow',
  'queue',
  'schedule',
  'interrupt',
  'replace',
  'updateActive',
  'suppress',
  'archiveOnly'
] as const;

export type QueueBehavior = (typeof QUEUE_BEHAVIORS)[number];

type BroadcastPriority = 'critical' | 'high' | 'normal' | 'low';
type Density = 'compact' | 'standard' | 'expanded';
type LayoutZone = 'Zone A' | 'Zone B' | 'Zone C' | 'Zone D' | 'Zone E' | 'Zone F';
type SponsorPolicy = 'permitted' | 'conditional' | 'suppressed' | 'required' | 'fallback';

export interface EventOptions {
  duration?: DurationMs;
  density?: Density;
  requestedZone?: LayoutZone;
  queueBehavior?: QueueBehavior;
  autoHide?: boolean;
  expiresAt?: ISODateTime;
  scheduledFor?: ISODateTime;
  sponsorBehavior?: SponsorPolicy;
  manualHold?: boolean;
}

export interface PermissionContext {
  role?: string;
  scopes?: string[];
  canUpdate?: boolean;
  canInterrupt?: boolean;
  canClear?: boolean;
  canSponsor?: boolean;
  canArchive?: boolean;
  canTriggerCritical?: boolean;
}

export interface EventEnvelope<TPayload = unknown> {
  id: EventId;
  name: EventName;
  source: EventSource;
  sourceType: EventSourceType;
  operatorId?: OperatorId;
  timestamp: ISODateTime;
  priority?: BroadcastPriority;
  targetObjectId?: BroadcastObjectId;
  targetObjectVersion?: number;
  payload: TPayload;
  options?: EventOptions;
  permissions?: PermissionContext;
  correlationId?: CorrelationId;
}

export type EventAckStatus = 'accepted' | 'duplicate' | 'rejected';

export interface EventAck {
  eventId: EventId;
  status: EventAckStatus;
  accepted: boolean;
  timestamp: ISODateTime;
  stateVersion?: number;
  errors?: EventValidationError[];
}

export interface EventValidationError extends ValidationIssue {
  eventId?: EventId;
}
