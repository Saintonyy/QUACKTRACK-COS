import type {
  AnalyticsRecordId,
  BroadcastObjectId,
  CorrelationId,
  DurationMs,
  EventId,
  ISODateTime,
  ModuleId,
  OperatorId,
  PlacementId,
  QueueItemId,
  RuntimeHealth,
  RuntimeStatus,
  SponsorId,
  CampaignId,
  ValidationResult
} from '@quacktrack/core';
import type { EventEnvelope } from '@quacktrack/events';
import type { BroadcastObject, SponsorFulfillmentStatus, SponsorPolicy } from '@quacktrack/objects';
import type { QueueItem } from '@quacktrack/queue';
import type { CollisionPolicy, LayoutZone, ScorebugStatus, SceneType } from '@quacktrack/layout';

export const ANALYTICS_TYPES = [
  'event.accepted',
  'event.rejected',
  'object.created',
  'object.validated',
  'object.queued',
  'object.visible',
  'object.updated',
  'object.completed',
  'object.interrupted',
  'object.expired',
  'object.archived',
  'sponsor.fulfilled',
  'sponsor.missed',
  'sponsor.suppressed',
  'layout.resolved',
  'layout.failed',
  'queue.added',
  'queue.removed',
  'queue.advanced',
  'runtime.state_changed',
  'runtime.error'
] as const;

export type AnalyticsType = (typeof ANALYTICS_TYPES)[number];

export interface LayoutAnalyticsPayload {
  requestedZone?: LayoutZone;
  resolvedZone?: LayoutZone;
  requestedDensity?: BroadcastObject['density'];
  resolvedDensity?: BroadcastObject['density'];
  collisionDetected: boolean;
  collisionAction?: CollisionPolicy;
  scorebugStatus?: ScorebugStatus;
  responsiveFallback?: boolean;
  sceneProfile?: SceneType;
}

export interface RuntimeStateAnalyticsPayload {
  previousState?: RuntimeStatus;
  nextState: RuntimeStatus;
  transitionReason: string;
  stateVersion: number;
  healthSnapshot: RuntimeHealth;
  operatorId?: OperatorId;
  timestamp: ISODateTime;
}

export interface SponsorAnalyticsPayload {
  sponsorId?: SponsorId;
  campaignId?: CampaignId;
  policy?: SponsorPolicy;
  fulfillmentStatus?: SponsorFulfillmentStatus;
  requiredDuration?: DurationMs;
  actualDuration?: DurationMs;
  reason?: string;
}

export interface AnalyticsRecord<TPayload = Record<string, unknown>> {
  id: AnalyticsRecordId;
  analyticsType: AnalyticsType;
  timestamp: ISODateTime;
  objectId?: BroadcastObjectId;
  eventId?: EventId;
  queueItemId?: QueueItemId;
  placementId?: PlacementId;
  moduleId?: ModuleId;
  operatorId?: OperatorId;
  correlationId?: CorrelationId;
  payload: TPayload;
}

export interface AnalyticsWriter {
  append(record: AnalyticsRecord): ValidationResult<AnalyticsRecord>;
  readAll(): AnalyticsRecord[];
}

export interface CreateAnalyticsRecordInput<TPayload = Record<string, unknown>> {
  id: AnalyticsRecordId;
  analyticsType: AnalyticsType;
  timestamp: ISODateTime;
  payload: TPayload;
  objectId?: BroadcastObject['id'];
  eventId?: EventEnvelope['id'];
  queueItemId?: QueueItem['id'];
  placementId?: PlacementId;
  moduleId?: ModuleId;
  operatorId?: OperatorId;
  correlationId?: CorrelationId;
}
