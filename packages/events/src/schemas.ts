import {
  ISODateTimeSchema,
  broadcastObjectIdSchema,
  correlationIdSchema,
  durationMsSchema,
  eventIdSchema,
  operatorIdSchema,
  validateWithSchema
} from '@quacktrack/core';
import { z } from 'zod';

import {
  EVENT_NAMESPACES,
  EVENT_SOURCES,
  EVENT_SOURCE_TYPES,
  KNOWN_EVENT_NAMES,
  QUEUE_BEHAVIORS,
  type EventEnvelope,
  type EventName,
  type EventOptions,
  type EventSource,
  type EventSourceType,
  type KnownEventName,
  type NamespacedEventName,
  type PermissionContext,
  type QueueBehavior
} from './types';

const constantStyleEventPattern = /^[A-Z][A-Z0-9_]*$/;
const namespacedEventPattern = /^(context|runtime|sponsor|replay|league)\.[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;

const broadcastPrioritySchema = z.enum(['critical', 'high', 'normal', 'low']);
const densitySchema = z.enum(['compact', 'standard', 'expanded']);
const layoutZoneSchema = z.enum(['Zone A', 'Zone B', 'Zone C', 'Zone D', 'Zone E', 'Zone F']);
const sponsorPolicySchema = z.enum(['permitted', 'conditional', 'suppressed', 'required', 'fallback']);

export const knownEventNameSchema: z.ZodType<KnownEventName> = z.enum(KNOWN_EVENT_NAMES);
export const eventNamespaceSchema = z.enum(EVENT_NAMESPACES);
export const namespacedEventNameSchema: z.ZodType<NamespacedEventName> = z
  .string()
  .regex(namespacedEventPattern) as z.ZodType<NamespacedEventName>;

export const eventNameSchema: z.ZodType<EventName> = z.string().superRefine((value, context) => {
  if (isKnownEventName(value) || isNamespacedEventName(value)) {
    return;
  }

  const isConstantStyle = constantStyleEventPattern.test(value);
  context.addIssue({
    code: z.ZodIssueCode.custom,
    message: isConstantStyle
      ? 'Unknown constant-style event name.'
      : 'Event name must be a known constant or a reserved namespaced event.'
  });
}) as z.ZodType<EventName>;

export const eventSourceSchema: z.ZodType<EventSource> = z.enum(EVENT_SOURCES);
export const eventSourceTypeSchema: z.ZodType<EventSourceType> = z.enum(EVENT_SOURCE_TYPES);
export const queueBehaviorSchema: z.ZodType<QueueBehavior> = z.enum(QUEUE_BEHAVIORS);

export const eventOptionsSchema: z.ZodType<EventOptions> = z.object({
  duration: durationMsSchema.optional(),
  density: densitySchema.optional(),
  requestedZone: layoutZoneSchema.optional(),
  queueBehavior: queueBehaviorSchema.optional(),
  autoHide: z.boolean().optional(),
  expiresAt: ISODateTimeSchema.optional(),
  scheduledFor: ISODateTimeSchema.optional(),
  sponsorBehavior: sponsorPolicySchema.optional(),
  manualHold: z.boolean().optional()
}) as unknown as z.ZodType<EventOptions>;

export const permissionContextSchema: z.ZodType<PermissionContext> = z.object({
  role: z.string().min(1).optional(),
  scopes: z.array(z.string().min(1)).optional(),
  canUpdate: z.boolean().optional(),
  canInterrupt: z.boolean().optional(),
  canClear: z.boolean().optional(),
  canSponsor: z.boolean().optional(),
  canArchive: z.boolean().optional(),
  canTriggerCritical: z.boolean().optional()
}) as unknown as z.ZodType<PermissionContext>;

export const eventEnvelopeSchema: z.ZodType<EventEnvelope> = z
  .object({
    id: eventIdSchema,
    name: eventNameSchema,
    source: eventSourceSchema,
    sourceType: eventSourceTypeSchema,
    operatorId: operatorIdSchema.optional(),
    timestamp: ISODateTimeSchema,
    priority: broadcastPrioritySchema.optional(),
    targetObjectId: broadcastObjectIdSchema.optional(),
    targetObjectVersion: z.number().int().nonnegative().optional(),
    payload: z.unknown(),
    options: eventOptionsSchema.optional(),
    permissions: permissionContextSchema.optional(),
    correlationId: correlationIdSchema.optional()
  })
  .superRefine((event, context) => {
    if (event.name === 'COS_UPDATE' && event.targetObjectVersion === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['targetObjectVersion'],
        message: 'COS_UPDATE requires targetObjectVersion.'
      });
    }
  }) as z.ZodType<EventEnvelope>;

export const eventValidationErrorSchema = z.object({
  path: z.string(),
  code: z.string().min(1),
  message: z.string().min(1),
  eventId: eventIdSchema.optional()
});

export const eventAckSchema = z.object({
  eventId: eventIdSchema,
  status: z.enum(['accepted', 'duplicate', 'rejected']),
  accepted: z.boolean(),
  timestamp: ISODateTimeSchema,
  stateVersion: z.number().int().nonnegative().optional(),
  errors: z.array(eventValidationErrorSchema).optional()
});

export function isKnownEventName(value: string): value is KnownEventName {
  return (KNOWN_EVENT_NAMES as readonly string[]).includes(value);
}

export function isNamespacedEventName(value: string): value is NamespacedEventName {
  return namespacedEventPattern.test(value);
}

export function validateEventEnvelope(input: unknown) {
  return validateWithSchema(eventEnvelopeSchema, input);
}

export function isDuplicateEventId(
  incoming: { id: string },
  existing: { id: string } | Iterable<{ id: string }>
): boolean {
  if (Symbol.iterator in Object(existing)) {
    for (const event of existing as Iterable<{ id: string }>) {
      if (event.id === incoming.id) {
        return true;
      }
    }

    return false;
  }

  return incoming.id === (existing as { id: string }).id;
}

export function isIdempotencyConflict(
  incoming: { id: string; payload: unknown },
  existing: { id: string; payload: unknown }
): boolean {
  return incoming.id === existing.id && stableStringify(incoming.payload) !== stableStringify(existing.payload);
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortObject(value));
}

function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortObject);
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, sortObject(nestedValue)])
    );
  }

  return value;
}
