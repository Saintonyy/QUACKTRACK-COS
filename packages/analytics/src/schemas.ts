import {
  ISODateTimeSchema,
  analyticsRecordIdSchema,
  broadcastObjectIdSchema,
  correlationIdSchema,
  durationMsSchema,
  eventIdSchema,
  moduleIdSchema,
  operatorIdSchema,
  placementIdSchema,
  queueItemIdSchema,
  runtimeHealthSchema,
  runtimeStatusSchema,
  sponsorIdSchema,
  campaignIdSchema,
  validateWithSchema,
  type ValidationResult
} from '@quacktrack/core';
import { z } from 'zod';

import {
  ANALYTICS_TYPES,
  type AnalyticsRecord,
  type AnalyticsType,
  type AnalyticsWriter,
  type CreateAnalyticsRecordInput,
  type LayoutAnalyticsPayload,
  type RuntimeStateAnalyticsPayload,
  type SponsorAnalyticsPayload
} from './types';

const layoutZoneSchema = z.enum(['Zone A', 'Zone B', 'Zone C', 'Zone D', 'Zone E', 'Zone F']);
const densitySchema = z.enum(['compact', 'standard', 'expanded']);
const collisionPolicySchema = z.enum(['replace', 'stack', 'queue', 'reject', 'compact', 'relocate']);
const scorebugStatusSchema = z.enum(['clear', 'near', 'blocked', 'override_requested', 'override_rejected']);
const sceneTypeSchema = z.enum(['live_game', 'replay', 'interview', 'halftime', 'starting_soon', 'postgame', 'emergency']);
const sponsorPolicySchema = z.enum(['permitted', 'conditional', 'suppressed', 'required', 'fallback']);
const sponsorFulfillmentStatusSchema = z.enum([
  'pending',
  'fulfilled',
  'interrupted',
  'missed',
  'rescheduled',
  'suppressed',
  'not_required'
]);

export const analyticsTypeSchema: z.ZodType<AnalyticsType> = z.enum(ANALYTICS_TYPES);

export const layoutAnalyticsPayloadSchema: z.ZodType<LayoutAnalyticsPayload> = z.object({
  requestedZone: layoutZoneSchema.optional(),
  resolvedZone: layoutZoneSchema.optional(),
  requestedDensity: densitySchema.optional(),
  resolvedDensity: densitySchema.optional(),
  collisionDetected: z.boolean(),
  collisionAction: collisionPolicySchema.optional(),
  scorebugStatus: scorebugStatusSchema.optional(),
  responsiveFallback: z.boolean().optional(),
  sceneProfile: sceneTypeSchema.optional()
}) as unknown as z.ZodType<LayoutAnalyticsPayload>;

export const runtimeStateAnalyticsPayloadSchema: z.ZodType<RuntimeStateAnalyticsPayload> = z.object({
  previousState: runtimeStatusSchema.optional(),
  nextState: runtimeStatusSchema,
  transitionReason: z.string().min(1),
  stateVersion: z.number().int().nonnegative(),
  healthSnapshot: runtimeHealthSchema,
  operatorId: operatorIdSchema.optional(),
  timestamp: ISODateTimeSchema
}) as unknown as z.ZodType<RuntimeStateAnalyticsPayload>;

export const sponsorAnalyticsPayloadSchema: z.ZodType<SponsorAnalyticsPayload> = z.object({
  sponsorId: sponsorIdSchema.optional(),
  campaignId: campaignIdSchema.optional(),
  policy: sponsorPolicySchema.optional(),
  fulfillmentStatus: sponsorFulfillmentStatusSchema.optional(),
  requiredDuration: durationMsSchema.optional(),
  actualDuration: durationMsSchema.optional(),
  reason: z.string().min(1).optional()
}) as unknown as z.ZodType<SponsorAnalyticsPayload>;

export const analyticsRecordSchema: z.ZodType<AnalyticsRecord> = z.object({
  id: analyticsRecordIdSchema,
  analyticsType: analyticsTypeSchema,
  timestamp: ISODateTimeSchema,
  objectId: broadcastObjectIdSchema.optional(),
  eventId: eventIdSchema.optional(),
  queueItemId: queueItemIdSchema.optional(),
  placementId: placementIdSchema.optional(),
  moduleId: moduleIdSchema.optional(),
  operatorId: operatorIdSchema.optional(),
  correlationId: correlationIdSchema.optional(),
  payload: z.record(z.unknown())
}) as unknown as z.ZodType<AnalyticsRecord>;

export function validateAnalyticsRecord(input: unknown): ValidationResult<AnalyticsRecord> {
  return validateWithSchema(analyticsRecordSchema, input);
}

export function createAnalyticsRecord<TPayload extends Record<string, unknown>>(
  input: CreateAnalyticsRecordInput<TPayload>
): ValidationResult<AnalyticsRecord<TPayload>> {
  const record: AnalyticsRecord<TPayload> = {
    id: input.id,
    analyticsType: input.analyticsType,
    timestamp: input.timestamp,
    payload: input.payload
  };

  if (input.objectId !== undefined) {
    record.objectId = input.objectId;
  }

  if (input.eventId !== undefined) {
    record.eventId = input.eventId;
  }

  if (input.queueItemId !== undefined) {
    record.queueItemId = input.queueItemId;
  }

  if (input.placementId !== undefined) {
    record.placementId = input.placementId;
  }

  if (input.moduleId !== undefined) {
    record.moduleId = input.moduleId;
  }

  if (input.operatorId !== undefined) {
    record.operatorId = input.operatorId;
  }

  if (input.correlationId !== undefined) {
    record.correlationId = input.correlationId;
  }

  return validateWithSchema(analyticsRecordSchema as z.ZodType<AnalyticsRecord<TPayload>>, record);
}

export class InMemoryAnalyticsWriter implements AnalyticsWriter {
  readonly #records: AnalyticsRecord[] = [];

  append(record: AnalyticsRecord): ValidationResult<AnalyticsRecord> {
    const validation = validateAnalyticsRecord(record);

    if (!validation.success) {
      return validation;
    }

    const copy = cloneRecord(validation.data);
    this.#records.push(copy);

    return {
      success: true,
      data: cloneRecord(copy)
    };
  }

  readAll(): AnalyticsRecord[] {
    return this.#records.map((record) => cloneRecord(record));
  }
}

function cloneRecord<TRecord extends AnalyticsRecord>(record: TRecord): TRecord {
  if (typeof structuredClone === 'function') {
    return structuredClone(record);
  }

  return JSON.parse(JSON.stringify(record)) as TRecord;
}
