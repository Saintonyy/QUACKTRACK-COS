import {
  ISODateTimeSchema,
  broadcastObjectIdSchema,
  campaignIdSchema,
  correlationIdSchema,
  durationMsSchema,
  eventIdSchema,
  operatorIdSchema,
  sponsorIdSchema,
  validateWithSchema,
  versionStringSchema
} from '@quacktrack/core';
import { z } from 'zod';

import {
  BROADCAST_OBJECT_FAMILIES,
  BROADCAST_OBJECT_LIFECYCLES,
  BROADCAST_OBJECT_TYPES,
  BROADCAST_PRIORITIES,
  COMPOSITION_TYPES,
  DENSITIES,
  REQUEUE_POLICIES,
  SPONSOR_DISPLAY_MODES,
  SPONSOR_FULFILLMENT_STATUSES,
  SPONSOR_POLICIES,
  type AnalyticsMetadata,
  type AnyBroadcastObject,
  type BroadcastObject,
  type BroadcastObjectFamily,
  type BroadcastObjectLifecycle,
  type BroadcastObjectPayload,
  type BroadcastObjectType,
  type BroadcastPriority,
  type CompoundPayload,
  type Density,
  type SponsorAttachment,
  type SponsorDisplayMode,
  type SponsorFulfillmentStatus,
  type SponsorPolicy
} from './types';

const nonEmptyStringSchema = z.string().min(1);
const layoutZoneSchema = z.enum(['Zone A', 'Zone B', 'Zone C', 'Zone D', 'Zone E', 'Zone F']);
const safeAreaStatusSchema = z.enum(['clear', 'near', 'blocked', 'override_requested', 'override_rejected']);
const collisionPolicySchema = z.enum(['replace', 'stack', 'queue', 'reject', 'compact', 'relocate']);
const eventNameSchema = z.string().min(1);
const eventNamespaceSchema = z.enum(['context', 'runtime', 'sponsor', 'replay', 'league']);
const eventSourceSchema = z.enum([
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
]);
const eventSourceTypeSchema = z.enum([
  'human',
  'system',
  'automation',
  'remote',
  'replay',
  'sponsor_scheduler',
  'ai'
]);

export const broadcastObjectTypeSchema: z.ZodType<BroadcastObjectType> = z.enum(BROADCAST_OBJECT_TYPES);
export const broadcastObjectFamilySchema: z.ZodType<BroadcastObjectFamily> = z.enum(BROADCAST_OBJECT_FAMILIES);
export const broadcastPrioritySchema: z.ZodType<BroadcastPriority> = z.enum(BROADCAST_PRIORITIES);
export const densitySchema: z.ZodType<Density> = z.enum(DENSITIES);
export const broadcastObjectLifecycleSchema: z.ZodType<BroadcastObjectLifecycle> =
  z.enum(BROADCAST_OBJECT_LIFECYCLES);

export const metricSchema = z.object({
  value: z.union([z.string(), z.number()]),
  label: nonEmptyStringSchema,
  unit: nonEmptyStringSchema.optional(),
  role: nonEmptyStringSchema.optional(),
  trend: z.enum(['up', 'down', 'flat', 'none']).optional()
});

export const sponsorPolicySchema: z.ZodType<SponsorPolicy> = z.enum(SPONSOR_POLICIES);
export const sponsorFulfillmentStatusSchema: z.ZodType<SponsorFulfillmentStatus> = z.enum(
  SPONSOR_FULFILLMENT_STATUSES
);
export const sponsorDisplayModeSchema: z.ZodType<SponsorDisplayMode> = z.enum(SPONSOR_DISPLAY_MODES);

export const sponsorAttachmentSchema: z.ZodType<SponsorAttachment> = z.object({
  sponsorId: sponsorIdSchema,
  sponsorName: nonEmptyStringSchema,
  sponsorSlot: nonEmptyStringSchema,
  campaignId: campaignIdSchema.optional(),
  displayMode: sponsorDisplayModeSchema,
  logoPath: nonEmptyStringSchema.optional(),
  presentationLabel: nonEmptyStringSchema.optional(),
  requiredDuration: durationMsSchema.optional(),
  policy: sponsorPolicySchema,
  fulfillmentStatus: sponsorFulfillmentStatusSchema
}) as unknown as z.ZodType<SponsorAttachment>;

export const playerPayloadSchema = z.object({
  playerId: nonEmptyStringSchema.optional(),
  playerName: nonEmptyStringSchema,
  number: z.union([z.string(), z.number()]).optional(),
  position: nonEmptyStringSchema.optional(),
  team: nonEmptyStringSchema,
  teamAbbreviation: nonEmptyStringSchema.optional(),
  headline: nonEmptyStringSchema.optional(),
  metrics: z.array(metricSchema).optional(),
  status: nonEmptyStringSchema.optional()
});

export const coachPayloadSchema = z.object({
  coachId: nonEmptyStringSchema.optional(),
  coachName: nonEmptyStringSchema,
  role: nonEmptyStringSchema,
  team: nonEmptyStringSchema.optional(),
  teamAbbreviation: nonEmptyStringSchema.optional(),
  segment: nonEmptyStringSchema.optional(),
  note: nonEmptyStringSchema.optional()
});

export const interviewPayloadSchema = z.object({
  subjectId: nonEmptyStringSchema.optional(),
  subjectName: nonEmptyStringSchema,
  subjectRole: nonEmptyStringSchema.optional(),
  team: nonEmptyStringSchema.optional(),
  segmentLabel: nonEmptyStringSchema,
  segmentPhase: nonEmptyStringSchema.optional(),
  interviewerName: nonEmptyStringSchema.optional(),
  isLive: z.boolean().optional()
});

export const statPayloadSchema = z.object({
  statId: nonEmptyStringSchema.optional(),
  subjectType: z.enum(['player', 'team', 'game', 'league']).optional(),
  subjectId: nonEmptyStringSchema.optional(),
  subjectName: nonEmptyStringSchema.optional(),
  statCategory: nonEmptyStringSchema.optional(),
  primaryMetric: metricSchema,
  secondaryMetrics: z.array(metricSchema).optional(),
  source: nonEmptyStringSchema.optional(),
  isOfficial: z.boolean().optional(),
  confidence: z.number().min(0).max(1).optional(),
  timestamp: ISODateTimeSchema.optional()
});

export const breakingPayloadSchema = z.object({
  headline: nonEmptyStringSchema,
  detail: nonEmptyStringSchema.optional(),
  status: nonEmptyStringSchema.optional(),
  severity: z.enum(['info', 'watch', 'warning', 'critical']).optional(),
  relatedTeam: nonEmptyStringSchema.optional(),
  relatedPlayer: nonEmptyStringSchema.optional(),
  source: nonEmptyStringSchema.optional(),
  manualHold: z.boolean().optional()
});

export const weatherPayloadSchema = z.object({
  headline: nonEmptyStringSchema,
  severity: z.enum(['watch', 'warning', 'critical']),
  detail: nonEmptyStringSchema.optional(),
  source: nonEmptyStringSchema.optional(),
  manualHold: z.boolean().optional()
});

export const injuryPayloadSchema = z.object({
  headline: nonEmptyStringSchema,
  relatedPlayer: nonEmptyStringSchema.optional(),
  relatedTeam: nonEmptyStringSchema.optional(),
  status: nonEmptyStringSchema.optional(),
  source: nonEmptyStringSchema.optional(),
  manualHold: z.boolean().optional()
});

export const replayPayloadSchema = z.object({
  replayId: nonEmptyStringSchema.optional(),
  replayLabel: nonEmptyStringSchema,
  momentDescription: nonEmptyStringSchema,
  relatedPlay: nonEmptyStringSchema.optional(),
  relatedPlayer: nonEmptyStringSchema.optional(),
  relatedTeam: nonEmptyStringSchema.optional(),
  relatedStat: metricSchema.optional(),
  angleLabel: nonEmptyStringSchema.optional(),
  source: nonEmptyStringSchema.optional()
});

export const sponsorPayloadSchema = z.object({
  sponsorId: sponsorIdSchema.optional(),
  sponsorName: nonEmptyStringSchema,
  sponsorSlot: nonEmptyStringSchema,
  campaignId: campaignIdSchema.optional(),
  category: nonEmptyStringSchema.optional(),
  logoPath: nonEmptyStringSchema.optional(),
  presentationLabel: nonEmptyStringSchema.optional(),
  message: nonEmptyStringSchema.optional(),
  callToAction: nonEmptyStringSchema.optional(),
  requiredDuration: durationMsSchema.optional(),
  fulfillmentId: nonEmptyStringSchema.optional()
});

export const playerOfTheGamePayloadSchema = z.object({
  playerId: nonEmptyStringSchema.optional(),
  playerName: nonEmptyStringSchema,
  team: nonEmptyStringSchema,
  number: z.union([z.string(), z.number()]).optional(),
  position: nonEmptyStringSchema.optional(),
  metrics: z.array(metricSchema).optional(),
  sponsor: sponsorAttachmentSchema.optional(),
  awardLabel: nonEmptyStringSchema.optional()
});

export const broadcastObjectPayloadSchema: z.ZodType<BroadcastObjectPayload> = z.lazy(() =>
  z.union([
    playerPayloadSchema,
    coachPayloadSchema,
    interviewPayloadSchema,
    statPayloadSchema,
    breakingPayloadSchema,
    weatherPayloadSchema,
    injuryPayloadSchema,
    replayPayloadSchema,
    sponsorPayloadSchema,
    playerOfTheGamePayloadSchema,
    compoundPayloadSchema
  ])
) as z.ZodType<BroadcastObjectPayload>;

export const compoundPayloadSchema: z.ZodType<CompoundPayload> = z
  .object({
    parentObjectId: broadcastObjectIdSchema,
    childObjectIds: z.array(broadcastObjectIdSchema).min(1).optional(),
    childPayloads: z.array(broadcastObjectPayloadSchema).min(1).optional(),
    compositionType: z.enum(COMPOSITION_TYPES),
    analyticsGroupId: nonEmptyStringSchema.optional(),
    requeuePolicy: z.enum(REQUEUE_POLICIES).optional()
  })
  .superRefine((payload, context) => {
    if (payload.childObjectIds === undefined && payload.childPayloads === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['childObjectIds'],
        message: 'Compound payload requires childObjectIds or childPayloads.'
      });
    }
  }) as z.ZodType<CompoundPayload>;

const permissionContextSchema = z.object({
  role: nonEmptyStringSchema.optional(),
  scopes: z.array(nonEmptyStringSchema).optional(),
  canUpdate: z.boolean().optional(),
  canInterrupt: z.boolean().optional(),
  canClear: z.boolean().optional(),
  canSponsor: z.boolean().optional(),
  canArchive: z.boolean().optional(),
  canTriggerCritical: z.boolean().optional()
});

export const analyticsMetadataSchema: z.ZodType<AnalyticsMetadata> = z.object({
  impressions: z.number().int().nonnegative(),
  displayTime: durationMsSchema,
  firstShownAt: ISODateTimeSchema.optional(),
  lastHiddenAt: ISODateTimeSchema.optional(),
  completionStatus: z.enum(['pending', 'completed', 'interrupted', 'expired', 'rejected']).optional(),
  interruptionCount: z.number().int().nonnegative(),
  interruptionReason: nonEmptyStringSchema.optional(),
  queueWaitTime: durationMsSchema.optional(),
  expirationStatus: z.enum(['active', 'expired', 'not_applicable']).optional(),
  sponsorFulfillmentStatus: sponsorFulfillmentStatusSchema.optional(),
  operatorSource: eventSourceSchema.optional()
}) as unknown as z.ZodType<AnalyticsMetadata>;

export const layoutMetadataSchema = z.object({
  requestedZone: layoutZoneSchema.optional(),
  resolvedZone: layoutZoneSchema.optional(),
  safeAreaPolicy: safeAreaStatusSchema.optional(),
  density: densitySchema.optional(),
  collisionPolicy: collisionPolicySchema.optional(),
  scorebugProtected: z.boolean().optional()
});

export const timingMetadataSchema = z.object({
  duration: durationMsSchema.optional(),
  autoHide: z.boolean().optional(),
  expiresAt: ISODateTimeSchema.optional(),
  scheduledFor: ISODateTimeSchema.optional(),
  scheduleWindowStart: ISODateTimeSchema.optional(),
  scheduleWindowEnd: ISODateTimeSchema.optional(),
  manualHold: z.boolean().optional()
});

export const sourceMetadataSchema = z.object({
  eventId: eventIdSchema,
  eventName: eventNameSchema,
  eventNamespace: eventNamespaceSchema.optional(),
  source: eventSourceSchema,
  sourceType: eventSourceTypeSchema,
  operatorId: operatorIdSchema.optional(),
  timestamp: ISODateTimeSchema
});

const baseBroadcastObjectSchema = z.object({
  id: broadcastObjectIdSchema,
  objectVersion: z.number().int().min(1),
  schemaVersion: versionStringSchema,
  lifecycle: broadcastObjectLifecycleSchema,
  priority: broadcastPrioritySchema,
  sponsor: sponsorAttachmentSchema.nullable().optional(),
  permissions: permissionContextSchema.optional(),
  analytics: analyticsMetadataSchema,
  layout: layoutMetadataSchema.optional(),
  density: densitySchema.optional(),
  timing: timingMetadataSchema.optional(),
  source: sourceMetadataSchema,
  correlationId: correlationIdSchema.optional(),
  createdAt: ISODateTimeSchema,
  validatedAt: ISODateTimeSchema.optional(),
  queuedAt: ISODateTimeSchema.optional(),
  scheduledAt: ISODateTimeSchema.optional(),
  shownAt: ISODateTimeSchema.optional(),
  updatedAt: ISODateTimeSchema.optional(),
  completedAt: ISODateTimeSchema.optional(),
  archivedAt: ISODateTimeSchema.optional()
});

const playerBroadcastObjectSchema = baseBroadcastObjectSchema.extend({
  type: z.literal('player'),
  family: z.literal('Person Context'),
  payload: playerPayloadSchema
});

const coachBroadcastObjectSchema = baseBroadcastObjectSchema.extend({
  type: z.literal('coach'),
  family: z.literal('Person Context'),
  payload: coachPayloadSchema
});

const interviewBroadcastObjectSchema = baseBroadcastObjectSchema.extend({
  type: z.literal('interview'),
  family: z.literal('Person Context'),
  payload: interviewPayloadSchema
});

const statBroadcastObjectSchema = baseBroadcastObjectSchema.extend({
  type: z.literal('stat'),
  family: z.literal('Performance Context'),
  payload: statPayloadSchema
});

const breakingBroadcastObjectSchema = baseBroadcastObjectSchema.extend({
  type: z.literal('breaking'),
  family: z.literal('Game Context'),
  payload: breakingPayloadSchema
});

const weatherBroadcastObjectSchema = baseBroadcastObjectSchema.extend({
  type: z.literal('weather'),
  family: z.literal('Game Context'),
  payload: weatherPayloadSchema
});

const injuryBroadcastObjectSchema = baseBroadcastObjectSchema.extend({
  type: z.literal('injury'),
  family: z.literal('Game Context'),
  payload: injuryPayloadSchema
});

const replayBroadcastObjectSchema = baseBroadcastObjectSchema.extend({
  type: z.literal('replay'),
  family: z.literal('Game Context'),
  payload: replayPayloadSchema
});

const sponsorBroadcastObjectSchema = baseBroadcastObjectSchema.extend({
  type: z.literal('sponsor'),
  family: z.literal('Commercial Context'),
  payload: sponsorPayloadSchema
});

const playerOfTheGameBroadcastObjectSchema = baseBroadcastObjectSchema.extend({
  type: z.literal('playerOfTheGame'),
  family: broadcastObjectFamilySchema,
  payload: playerOfTheGamePayloadSchema
});

const compoundBroadcastObjectSchema = baseBroadcastObjectSchema.extend({
  type: z.literal('compound'),
  family: broadcastObjectFamilySchema,
  payload: compoundPayloadSchema
});

export const broadcastObjectSchema: z.ZodType<AnyBroadcastObject> = z.discriminatedUnion('type', [
  playerBroadcastObjectSchema,
  coachBroadcastObjectSchema,
  interviewBroadcastObjectSchema,
  statBroadcastObjectSchema,
  breakingBroadcastObjectSchema,
  weatherBroadcastObjectSchema,
  injuryBroadcastObjectSchema,
  replayBroadcastObjectSchema,
  sponsorBroadcastObjectSchema,
  playerOfTheGameBroadcastObjectSchema,
  compoundBroadcastObjectSchema
]) as unknown as z.ZodType<AnyBroadcastObject>;

export function validateBroadcastObject(input: unknown) {
  return validateWithSchema(broadcastObjectSchema, input);
}

export function validateSponsorAttachment(input: unknown) {
  return validateWithSchema(sponsorAttachmentSchema, input);
}

export function isStaleObjectUpdate(
  current: number | Pick<BroadcastObject, 'objectVersion'>,
  incoming: number | Pick<BroadcastObject, 'objectVersion'>
): boolean {
  const currentVersion = typeof current === 'number' ? current : current.objectVersion;
  const incomingVersion = typeof incoming === 'number' ? incoming : incoming.objectVersion;

  return incomingVersion < currentVersion;
}
