import { ISODateTimeSchema, runtimeErrorSchema, validateWithSchema, type ISODateTime } from '@quacktrack/core';
import { resolvedPlacementSchema } from '@quacktrack/layout';
import { resolvedModuleDefinitionSchema } from '@quacktrack/registry';
import { z } from 'zod';

import {
  RENDER_LIFECYCLE_EVENTS,
  type RenderLifecycleEvent,
  type RendererError,
  type RendererInput,
  type RendererResult
} from './types';

export const rendererInputSchema: z.ZodType<RendererInput> = z.object({
  resolvedModule: resolvedModuleDefinitionSchema,
  placement: resolvedPlacementSchema
}) as unknown as z.ZodType<RendererInput>;

export const rendererErrorSchema: z.ZodType<RendererError> = runtimeErrorSchema as z.ZodType<RendererError>;

export const rendererResultSchema: z.ZodType<RendererResult> = z.union([
  z.object({
    success: z.literal(true),
    moduleId: z.string().min(1),
    placementId: z.string().min(1),
    timestamp: ISODateTimeSchema
  }),
  z.object({
    success: z.literal(false),
    error: rendererErrorSchema
  })
]) as unknown as z.ZodType<RendererResult>;

export const renderLifecycleEventSchema: z.ZodType<RenderLifecycleEvent> = z.object({
  type: z.enum(RENDER_LIFECYCLE_EVENTS),
  moduleId: z.string().min(1),
  placementId: z.string().min(1).optional(),
  timestamp: ISODateTimeSchema,
  error: rendererErrorSchema.optional()
}) as unknown as z.ZodType<RenderLifecycleEvent>;

export function validateRendererInput(input: unknown) {
  return validateWithSchema(rendererInputSchema, input);
}

export function renderResolvedModule(input: unknown, timestamp: ISODateTime = new Date().toISOString() as ISODateTime): RendererResult {
  const validation = validateRendererInput(input);

  if (!validation.success) {
    return {
      success: false,
      error: {
        code: 'RENDERER_INVALID_INPUT',
        message: validation.errors.map((error) => `${error.path}: ${error.message}`).join('; '),
        source: '@quacktrack/renderer',
        recoverable: true,
        timestamp
      }
    };
  }

  return {
    success: true,
    moduleId: validation.data.resolvedModule.moduleId,
    placementId: validation.data.placement.placementId,
    timestamp
  };
}
