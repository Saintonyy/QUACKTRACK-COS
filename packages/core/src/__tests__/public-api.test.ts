import { describe, expect, it } from 'vitest';

import {
  ANIMATION_STATES,
  HEALTH_STATUSES,
  RUNTIME_STATUSES,
  animationStateSchema,
  healthStatusSchema,
  rectSchema,
  runtimeErrorSchema,
  runtimeStateSnapshotSchema,
  runtimeStatusSchema,
  sizeSchema,
  validateRect,
  validateRuntimeStateSnapshot,
  validateSize,
  validateValidationResult,
  validationResultSchema,
  type RuntimeHealth
} from '..';

const timestamp = '2026-06-13T23:00:00.000Z';

const healthyRuntime: RuntimeHealth = {
  overall: 'healthy',
  eventBus: 'healthy',
  queueEngine: 'healthy',
  moduleRegistry: 'healthy',
  layoutEngine: 'healthy',
  renderer: 'healthy',
  sponsorPolicy: 'healthy',
  analytics: 'healthy',
  cloudControl: 'healthy',
  obsConnection: 'healthy'
};

describe('@quacktrack/core public API', () => {
  it('validates allowed runtime statuses only', () => {
    for (const status of RUNTIME_STATUSES) {
      expect(runtimeStatusSchema.parse(status)).toBe(status);
    }

    expect(runtimeStatusSchema.safeParse('PAUSED')).toMatchObject({ success: false });
  });

  it('validates allowed health statuses only', () => {
    for (const status of HEALTH_STATUSES) {
      expect(healthStatusSchema.parse(status)).toBe(status);
    }

    expect(healthStatusSchema.safeParse('ok')).toMatchObject({ success: false });
  });

  it('validates allowed animation states only', () => {
    for (const state of ANIMATION_STATES) {
      expect(animationStateSchema.parse(state)).toBe(state);
    }

    expect(animationStateSchema.safeParse('paused')).toMatchObject({ success: false });
  });

  it('requires runtime snapshot core fields', () => {
    const result = runtimeStateSnapshotSchema.safeParse({
      state: 'READY',
      stateVersion: 0,
      enteredAt: timestamp,
      updatedAt: timestamp,
      health: healthyRuntime
    });

    expect(result.success).toBe(true);
    expect(runtimeStateSnapshotSchema.safeParse({ state: 'READY' })).toMatchObject({
      success: false
    });
  });

  it('rejects negative runtime snapshot versions', () => {
    const result = validateRuntimeStateSnapshot({
      state: 'READY',
      stateVersion: -1,
      enteredAt: timestamp,
      updatedAt: timestamp,
      health: healthyRuntime
    });

    expect(result.success).toBe(false);
  });

  it('enforces positive Size dimensions', () => {
    expect(validateSize({ width: 1920, height: 1080 })).toEqual({
      success: true,
      data: { width: 1920, height: 1080 }
    });
    expect(sizeSchema.safeParse({ width: 0, height: 1080 })).toMatchObject({
      success: false
    });
  });

  it('enforces Rect coordinates and positive dimensions', () => {
    expect(validateRect({ x: 0, y: 0, width: 640, height: 360 })).toEqual({
      success: true,
      data: { x: 0, y: 0, width: 640, height: 360 }
    });
    expect(rectSchema.safeParse({ x: -1, y: 0, width: 640, height: 360 })).toMatchObject({
      success: false
    });
    expect(rectSchema.safeParse({ x: 0, y: 0, width: 0, height: 360 })).toMatchObject({
      success: false
    });
  });

  it('validates RuntimeError shape', () => {
    expect(
      runtimeErrorSchema.parse({
        code: 'RENDER_TIMEOUT',
        message: 'Renderer did not report completion.',
        recoverable: true,
        timestamp
      })
    ).toEqual({
      code: 'RENDER_TIMEOUT',
      message: 'Renderer did not report completion.',
      recoverable: true,
      timestamp
    });

    expect(
      runtimeErrorSchema.safeParse({
        code: 'RENDER_TIMEOUT',
        message: 'Renderer did not report completion.',
        timestamp
      })
    ).toMatchObject({ success: false });
  });

  it('validates ValidationResult success and failure shapes', () => {
    const resultSchema = validationResultSchema(runtimeStatusSchema);

    expect(resultSchema.parse({ success: true, data: 'LIVE' })).toEqual({
      success: true,
      data: 'LIVE'
    });
    expect(
      resultSchema.parse({
        success: false,
        errors: [{ path: 'state', code: 'invalid_enum_value', message: 'Invalid state.' }]
      })
    ).toEqual({
      success: false,
      errors: [{ path: 'state', code: 'invalid_enum_value', message: 'Invalid state.' }]
    });
    expect(validateValidationResult(runtimeStatusSchema, { success: false, errors: [] })).toMatchObject({
      success: false
    });
  });
});
