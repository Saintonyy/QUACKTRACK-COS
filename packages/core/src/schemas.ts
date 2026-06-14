import { z } from 'zod';

import {
  ANIMATION_STATES,
  HEALTH_STATUSES,
  RUNTIME_STATUSES,
  type AnimationState,
  type AnalyticsRecordId,
  type BroadcastObjectId,
  type CampaignId,
  type CorrelationId,
  type DurationMs,
  type EventId,
  type HealthStatus,
  type ISODateTime,
  type ModuleId,
  type OperatorId,
  type PlacementId,
  type QueueItemId,
  type Rect,
  type RuntimeError,
  type RuntimeHealth,
  type RuntimeStateSnapshot,
  type RuntimeStatus,
  type SceneId,
  type Size,
  type SponsorId,
  type ValidationIssue,
  type ValidationResult,
  type VersionString
} from './types';

const isoDateTimeSchema = z.string().datetime({ offset: true }) as unknown as z.ZodType<ISODateTime>;

const brandedStringSchema = <TValue extends string>() => z.string().min(1) as unknown as z.ZodType<TValue>;

export const ISODateTimeSchema = isoDateTimeSchema;
export const durationMsSchema = z.number().finite().nonnegative() as unknown as z.ZodType<DurationMs>;
export const versionStringSchema = z.string().min(1) as unknown as z.ZodType<VersionString>;

export const eventIdSchema = brandedStringSchema<EventId>();
export const broadcastObjectIdSchema = brandedStringSchema<BroadcastObjectId>();
export const queueItemIdSchema = brandedStringSchema<QueueItemId>();
export const placementIdSchema = brandedStringSchema<PlacementId>();
export const moduleIdSchema = brandedStringSchema<ModuleId>();
export const sponsorIdSchema = brandedStringSchema<SponsorId>();
export const campaignIdSchema = brandedStringSchema<CampaignId>();
export const operatorIdSchema = brandedStringSchema<OperatorId>();
export const correlationIdSchema = brandedStringSchema<CorrelationId>();
export const analyticsRecordIdSchema = brandedStringSchema<AnalyticsRecordId>();
export const sceneIdSchema = brandedStringSchema<SceneId>();

export const sizeSchema: z.ZodType<Size> = z.object({
  width: z.number().finite().positive(),
  height: z.number().finite().positive()
});

export const rectSchema: z.ZodType<Rect> = z.object({
  x: z.number().finite().nonnegative(),
  y: z.number().finite().nonnegative(),
  width: z.number().finite().positive(),
  height: z.number().finite().positive()
});

export const runtimeStatusSchema: z.ZodType<RuntimeStatus> = z.enum(RUNTIME_STATUSES);
export const healthStatusSchema: z.ZodType<HealthStatus> = z.enum(HEALTH_STATUSES);
export const animationStateSchema: z.ZodType<AnimationState> = z.enum(ANIMATION_STATES);

export const runtimeErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  source: z.string().min(1).optional(),
  recoverable: z.boolean(),
  timestamp: ISODateTimeSchema,
  details: z.record(z.unknown()).optional()
}) as unknown as z.ZodType<RuntimeError>;

export const runtimeHealthSchema: z.ZodType<RuntimeHealth> = z.object({
  overall: healthStatusSchema,
  eventBus: healthStatusSchema,
  queueEngine: healthStatusSchema,
  moduleRegistry: healthStatusSchema,
  layoutEngine: healthStatusSchema,
  renderer: healthStatusSchema,
  sponsorPolicy: healthStatusSchema,
  analytics: healthStatusSchema,
  cloudControl: healthStatusSchema,
  obsConnection: healthStatusSchema
});

export const runtimeStateSnapshotSchema = z.object({
  state: runtimeStatusSchema,
  previousState: runtimeStatusSchema.optional(),
  stateVersion: z.number().int().nonnegative(),
  enteredAt: ISODateTimeSchema,
  updatedAt: ISODateTimeSchema,
  health: runtimeHealthSchema,
  visible: z.boolean().optional(),
  animationState: animationStateSchema.optional(),
  activeObjectId: broadcastObjectIdSchema.optional(),
  activeObjectIds: z.array(broadcastObjectIdSchema).optional(),
  activeModuleId: moduleIdSchema.optional(),
  activePlacementId: placementIdSchema.optional(),
  queueLength: z.number().int().nonnegative().optional(),
  activeSceneId: sceneIdSchema.optional(),
  error: runtimeErrorSchema.nullable().optional(),
  metadata: z.record(z.unknown()).optional()
}) as unknown as z.ZodType<RuntimeStateSnapshot>;

export const validationIssueSchema: z.ZodType<ValidationIssue> = z.object({
  path: z.string(),
  code: z.string().min(1),
  message: z.string().min(1)
});

export const validationSuccessSchema = <TValue extends z.ZodTypeAny>(dataSchema: TValue) =>
  z.object({
    success: z.literal(true),
    data: dataSchema
  });

export const validationFailureSchema = z.object({
  success: z.literal(false),
  errors: z.array(validationIssueSchema).min(1)
});

export const validationResultSchema = <TValue extends z.ZodTypeAny>(dataSchema: TValue) =>
  z.union([validationSuccessSchema(dataSchema), validationFailureSchema]) as unknown as z.ZodType<
    ValidationResult<z.output<TValue>>
  >;

function toValidationIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    code: issue.code,
    message: issue.message
  }));
}

export function validateWithSchema<TValue>(
  schema: z.ZodType<TValue>,
  input: unknown
): ValidationResult<TValue> {
  const result = schema.safeParse(input);

  if (result.success) {
    return {
      success: true,
      data: result.data
    };
  }

  return {
    success: false,
    errors: toValidationIssues(result.error)
  };
}

export function validateSize(input: unknown): ValidationResult<Size> {
  return validateWithSchema(sizeSchema, input);
}

export function validateRect(input: unknown): ValidationResult<Rect> {
  return validateWithSchema(rectSchema, input);
}

export function validateRuntimeError(input: unknown): ValidationResult<RuntimeError> {
  return validateWithSchema(runtimeErrorSchema, input);
}

export function validateRuntimeHealth(input: unknown): ValidationResult<RuntimeHealth> {
  return validateWithSchema(runtimeHealthSchema, input);
}

export function validateRuntimeStateSnapshot(input: unknown): ValidationResult<RuntimeStateSnapshot> {
  return validateWithSchema(runtimeStateSnapshotSchema, input);
}

export function validateValidationResult<TValue>(
  dataSchema: z.ZodType<TValue>,
  input: unknown
): ValidationResult<ValidationResult<TValue>> {
  return validateWithSchema(validationResultSchema(dataSchema), input);
}
