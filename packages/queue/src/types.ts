import type {
  AnalyticsRecordId,
  BroadcastObjectId,
  CorrelationId,
  DurationMs,
  ISODateTime,
  ModuleId,
  QueueItemId
} from '@quacktrack/core';
import type { EventName, EventSource } from '@quacktrack/events';
import type {
  BroadcastObject,
  BroadcastObjectLifecycle,
  BroadcastObjectPayload,
  BroadcastObjectType,
  BroadcastPriority,
  SponsorAttachment
} from '@quacktrack/objects';

export const QUEUE_ITEM_STATUSES = [
  'pending',
  'scheduled',
  'eligible',
  'blocked',
  'active',
  'completed',
  'expired',
  'removed',
  'interrupted'
] as const;

export type QueueItemStatus = (typeof QUEUE_ITEM_STATUSES)[number];

export interface ExpirationRule {
  expiresAt?: ISODateTime;
  expiresAfter?: DurationMs;
  manualHold?: boolean;
  sponsorWindowEnd?: ISODateTime;
}

export interface QueueItem<TPayload extends BroadcastObjectPayload = BroadcastObjectPayload> {
  id: QueueItemId;
  objectId: BroadcastObjectId;
  eventName: EventName;
  objectType: BroadcastObjectType;
  moduleId: ModuleId;
  payload: TPayload;
  priority: BroadcastPriority;
  duration?: DurationMs;
  autoHide: boolean;
  createdAt: ISODateTime;
  scheduledFor?: ISODateTime;
  expiration: ExpirationRule;
  triggerSource: EventSource;
  sponsor?: SponsorAttachment | null;
  lifecycle: BroadcastObjectLifecycle;
  analyticsRecordId?: AnalyticsRecordId;
  status: QueueItemStatus;
  position?: number;
  correlationId?: CorrelationId;
  supportsInterruption?: boolean;
}

export interface QueueStatus {
  items: QueueItem[];
  activeItemId?: QueueItemId;
  length: number;
  blockedCount: number;
  expiredCount: number;
}

export const QUEUE_DECISION_REASONS = [
  'accepted',
  'blocked',
  'expired',
  'removed',
  'selected_next',
  'no_eligible_item',
  'interrupted',
  'priority_order',
  'sponsor_missed',
  'sponsor_rescheduled'
] as const;

export type QueueDecisionReason = (typeof QUEUE_DECISION_REASONS)[number];

export interface QueueDecision<TItem extends QueueItem = QueueItem> {
  accepted: boolean;
  reason: QueueDecisionReason;
  item?: TItem;
  items?: TItem[];
  message?: string;
}

export const QUEUE_MUTATION_TYPES = ['add', 'remove', 'expire', 'activate', 'complete', 'interrupt', 'reschedule'] as const;

export type QueueMutationType = (typeof QUEUE_MUTATION_TYPES)[number];

export interface QueueMutation<TItem extends QueueItem = QueueItem> {
  type: QueueMutationType;
  item: TItem;
  timestamp: ISODateTime;
  reason?: QueueDecisionReason;
}

export interface CreateQueueItemInput {
  id: QueueItemId;
  object: BroadcastObject;
  eventName: EventName;
  moduleId: ModuleId;
  autoHide: boolean;
  createdAt: ISODateTime;
  expiration: ExpirationRule;
  triggerSource: EventSource;
  duration?: DurationMs;
  scheduledFor?: ISODateTime;
  analyticsRecordId?: AnalyticsRecordId;
  status?: QueueItemStatus;
  position?: number;
  supportsInterruption?: boolean;
}

export interface ExpireQueueItemsOptions {
  now: ISODateTime;
  markExpired?: boolean;
  rescheduleSponsorItems?: boolean;
  sponsorRescheduleFor?: ISODateTime;
}
