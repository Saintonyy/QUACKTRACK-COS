import {
  ISODateTimeSchema,
  analyticsRecordIdSchema,
  broadcastObjectIdSchema,
  correlationIdSchema,
  durationMsSchema,
  moduleIdSchema,
  queueItemIdSchema,
  validateWithSchema,
  type ValidationResult
} from '@quacktrack/core';
import { eventNameSchema, eventSourceSchema } from '@quacktrack/events';
import {
  broadcastObjectLifecycleSchema,
  broadcastObjectPayloadSchema,
  broadcastObjectSchema,
  broadcastObjectTypeSchema,
  broadcastPrioritySchema,
  sponsorAttachmentSchema,
  type BroadcastPriority
} from '@quacktrack/objects';
import { z } from 'zod';

import {
  QUEUE_DECISION_REASONS,
  QUEUE_ITEM_STATUSES,
  QUEUE_MUTATION_TYPES,
  type CreateQueueItemInput,
  type ExpirationRule,
  type ExpireQueueItemsOptions,
  type QueueDecision,
  type QueueItem,
  type QueueItemStatus,
  type QueueMutation,
  type QueueStatus
} from './types';

const priorityRank: Record<BroadcastPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3
};

export const queueItemStatusSchema: z.ZodType<QueueItemStatus> = z.enum(QUEUE_ITEM_STATUSES);

export const expirationRuleSchema: z.ZodType<ExpirationRule> = z.object({
  expiresAt: ISODateTimeSchema.optional(),
  expiresAfter: durationMsSchema.optional(),
  manualHold: z.boolean().optional(),
  sponsorWindowEnd: ISODateTimeSchema.optional()
}) as unknown as z.ZodType<ExpirationRule>;

export const queueItemSchema: z.ZodType<QueueItem> = z.object({
  id: queueItemIdSchema,
  objectId: broadcastObjectIdSchema,
  eventName: eventNameSchema,
  objectType: broadcastObjectTypeSchema,
  moduleId: moduleIdSchema,
  payload: broadcastObjectPayloadSchema,
  priority: broadcastPrioritySchema,
  duration: durationMsSchema.optional(),
  autoHide: z.boolean(),
  createdAt: ISODateTimeSchema,
  scheduledFor: ISODateTimeSchema.optional(),
  expiration: expirationRuleSchema,
  triggerSource: eventSourceSchema,
  sponsor: sponsorAttachmentSchema.nullable().optional(),
  lifecycle: broadcastObjectLifecycleSchema,
  analyticsRecordId: analyticsRecordIdSchema.optional(),
  status: queueItemStatusSchema,
  position: z.number().int().nonnegative().optional(),
  correlationId: correlationIdSchema.optional(),
  supportsInterruption: z.boolean().optional()
}) as unknown as z.ZodType<QueueItem>;

export const queueStatusSchema: z.ZodType<QueueStatus> = z.object({
  items: z.array(queueItemSchema),
  activeItemId: queueItemIdSchema.optional(),
  length: z.number().int().nonnegative(),
  blockedCount: z.number().int().nonnegative(),
  expiredCount: z.number().int().nonnegative()
}) as unknown as z.ZodType<QueueStatus>;

export const queueDecisionReasonSchema = z.enum(QUEUE_DECISION_REASONS);
export const queueDecisionSchema: z.ZodType<QueueDecision> = z.object({
  accepted: z.boolean(),
  reason: queueDecisionReasonSchema,
  item: queueItemSchema.optional(),
  items: z.array(queueItemSchema).optional(),
  message: z.string().min(1).optional()
}) as unknown as z.ZodType<QueueDecision>;

export const queueMutationTypeSchema = z.enum(QUEUE_MUTATION_TYPES);
export const queueMutationSchema: z.ZodType<QueueMutation> = z.object({
  type: queueMutationTypeSchema,
  item: queueItemSchema,
  timestamp: ISODateTimeSchema,
  reason: queueDecisionReasonSchema.optional()
}) as unknown as z.ZodType<QueueMutation>;

export function validateQueueItem(input: unknown): ValidationResult<QueueItem> {
  return validateWithSchema(queueItemSchema, input);
}

export function createQueueItem(input: CreateQueueItemInput): ValidationResult<QueueItem> {
  const item: QueueItem = {
    id: input.id,
    objectId: input.object.id,
    eventName: input.eventName,
    objectType: input.object.type,
    moduleId: input.moduleId,
    payload: input.object.payload,
    priority: input.object.priority,
    autoHide: input.autoHide,
    createdAt: input.createdAt,
    expiration: input.expiration,
    triggerSource: input.triggerSource,
    lifecycle: input.object.lifecycle,
    status: input.status ?? 'pending'
  };

  if (input.duration !== undefined) {
    item.duration = input.duration;
  }

  if (input.scheduledFor !== undefined) {
    item.scheduledFor = input.scheduledFor;
  }

  if (input.object.sponsor !== undefined) {
    item.sponsor = input.object.sponsor;
  }

  if (input.analyticsRecordId !== undefined) {
    item.analyticsRecordId = input.analyticsRecordId;
  }

  if (input.object.correlationId !== undefined) {
    item.correlationId = input.object.correlationId;
  }

  if (input.position !== undefined) {
    item.position = input.position;
  }

  if (input.supportsInterruption !== undefined) {
    item.supportsInterruption = input.supportsInterruption;
  }

  return validateQueueItem(item);
}

export function orderQueueItems<TItem extends QueueItem>(items: TItem[]): TItem[] {
  return items.slice().sort((left, right) => {
    const priorityDelta = priorityRank[left.priority] - priorityRank[right.priority];

    if (priorityDelta !== 0) {
      return priorityDelta;
    }

    const leftTime = Date.parse(left.createdAt);
    const rightTime = Date.parse(right.createdAt);

    if (leftTime !== rightTime) {
      return leftTime - rightTime;
    }

    return (left.position ?? Number.MAX_SAFE_INTEGER) - (right.position ?? Number.MAX_SAFE_INTEGER);
  });
}

export function selectNextQueueItem<TItem extends QueueItem>(items: TItem[], now?: string): QueueDecision<TItem> {
  const eligible = orderQueueItems(items).filter((item) => isSelectable(item, now));
  const item = eligible[0];

  if (item === undefined) {
    return {
      accepted: false,
      reason: 'no_eligible_item',
      message: 'No eligible queue item is available.'
    };
  }

  return {
    accepted: true,
    reason: 'selected_next',
    item
  };
}

export function expireQueueItems<TItem extends QueueItem>(
  items: TItem[],
  options: ExpireQueueItemsOptions
): QueueDecision<TItem> {
  let expiredCount = 0;
  let sponsorRescheduled = false;

  const nextItems = items.flatMap((item) => {
    const sponsorExpired = isSponsorWindowExpired(item, options.now);
    const expired = isExpired(item, options.now) || sponsorExpired;

    if (!expired) {
      return [item];
    }

    expiredCount += 1;

    if (sponsorExpired && item.objectType === 'sponsor' && options.rescheduleSponsorItems && options.sponsorRescheduleFor !== undefined) {
      sponsorRescheduled = true;
      const expiration = { ...item.expiration };
      delete expiration.sponsorWindowEnd;

      return [
        {
          ...item,
          scheduledFor: options.sponsorRescheduleFor,
          status: 'scheduled' as const,
          expiration
        } as TItem
      ];
    }

    if (options.markExpired) {
      return [
        {
          ...item,
          status: 'expired' as const,
          sponsor:
            item.objectType === 'sponsor' && item.sponsor !== undefined && item.sponsor !== null
              ? {
                  ...item.sponsor,
                  fulfillmentStatus: 'missed' as const
                }
              : item.sponsor
        } as TItem
      ];
    }

    return [];
  });

  const removedCount = items.length - nextItems.length;

  return {
    accepted: true,
    reason: sponsorRescheduled ? 'sponsor_rescheduled' : expiredCount > 0 || removedCount > 0 ? 'expired' : 'accepted',
    items: nextItems
  };
}

export function canInterrupt(incoming: QueueItem, active: QueueItem): boolean {
  if (active.supportsInterruption === false) {
    return false;
  }

  if (active.priority === 'critical') {
    return false;
  }

  return priorityRank[incoming.priority] < priorityRank[active.priority];
}

function isSelectable(item: QueueItem, now?: string): boolean {
  if (item.status === 'expired' || item.status === 'blocked' || item.status === 'removed' || item.status === 'completed') {
    return false;
  }

  if (now !== undefined && isExpired(item, now)) {
    return false;
  }

  if (item.scheduledFor !== undefined && now !== undefined && Date.parse(item.scheduledFor) > Date.parse(now)) {
    return false;
  }

  return item.status === 'pending' || item.status === 'eligible' || item.status === 'scheduled';
}

function isExpired(item: QueueItem, now: string): boolean {
  if (item.expiration.manualHold) {
    return false;
  }

  const nowMs = Date.parse(now);

  if (item.expiration.expiresAt !== undefined && Date.parse(item.expiration.expiresAt) <= nowMs) {
    return true;
  }

  if (item.expiration.expiresAfter !== undefined && Date.parse(item.createdAt) + item.expiration.expiresAfter <= nowMs) {
    return true;
  }

  return isSponsorWindowExpired(item, now);
}

function isSponsorWindowExpired(item: QueueItem, now: string): boolean {
  return item.expiration.sponsorWindowEnd !== undefined && Date.parse(item.expiration.sponsorWindowEnd) <= Date.parse(now);
}
