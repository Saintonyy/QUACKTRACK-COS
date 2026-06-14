import {
  broadcastObjectIdSchema,
  placementIdSchema,
  rectSchema,
  sceneIdSchema,
  sizeSchema,
  validateWithSchema,
  type Rect,
  type ValidationResult
} from '@quacktrack/core';
import { broadcastObjectSchema, broadcastPrioritySchema, densitySchema, type Density } from '@quacktrack/objects';
import { resolvedModuleDefinitionSchema } from '@quacktrack/registry';
import { z } from 'zod';

import {
  COLLISION_POLICIES,
  LAYOUT_ZONES,
  OPERATOR_MODES,
  PLACEMENT_ANCHORS,
  PLACEMENT_REASONS,
  RESERVED_ZONES,
  SAFE_AREA_STATUSES,
  SCENE_TYPES,
  SCOREBUG_STATUSES,
  type CollisionPolicy,
  type LayoutRequest,
  type LayoutZone,
  type OperatorMode,
  type PlacementAnchor,
  type PlacementReason,
  type ReservedZone,
  type ResolvedPlacement,
  type SafeAreaConfig,
  type SafeAreaStatus,
  type SceneContext,
  type SceneType,
  type ScorebugStatus
} from './types';

const zoneCapacity: Record<LayoutZone, number> = {
  'Zone A': 1,
  'Zone B': 1,
  'Zone C': 2,
  'Zone D': 1,
  'Zone E': 2,
  'Zone F': 1
};

const zoneAnchors: Record<LayoutZone, PlacementAnchor> = {
  'Zone A': 'top_left',
  'Zone B': 'top_right',
  'Zone C': 'bottom_left',
  'Zone D': 'bottom_center',
  'Zone E': 'bottom_right',
  'Zone F': 'full_width'
};

const priorityZIndex = {
  low: 20,
  normal: 30,
  high: 40,
  critical: 60
} as const;

export const sceneTypeSchema: z.ZodType<SceneType> = z.enum(SCENE_TYPES);
export const layoutZoneSchema: z.ZodType<LayoutZone> = z.enum(LAYOUT_ZONES);
export const reservedZoneSchema: z.ZodType<ReservedZone> = z.enum(RESERVED_ZONES);
export const operatorModeSchema: z.ZodType<OperatorMode> = z.enum(OPERATOR_MODES);
export const collisionPolicySchema: z.ZodType<CollisionPolicy> = z.enum(COLLISION_POLICIES);
export const safeAreaStatusSchema: z.ZodType<SafeAreaStatus> = z.enum(SAFE_AREA_STATUSES);
export const scorebugStatusSchema: z.ZodType<ScorebugStatus> = z.enum(SCOREBUG_STATUSES);
export const placementAnchorSchema: z.ZodType<PlacementAnchor> = z.enum(PLACEMENT_ANCHORS);
export const placementReasonSchema: z.ZodType<PlacementReason> = z.enum(PLACEMENT_REASONS);

export const scorebugStateSchema = z.object({
  present: z.boolean(),
  visible: z.boolean(),
  bounds: rectSchema.optional(),
  protected: z.boolean()
});

export const replayStateSchema = z.object({
  active: z.boolean(),
  replayId: z.string().min(1).optional(),
  angleLabel: z.string().min(1).optional()
});

export const sceneContextSchema: z.ZodType<SceneContext> = z.object({
  sceneId: sceneIdSchema,
  sceneType: sceneTypeSchema,
  outputResolution: sizeSchema,
  activeZones: z.array(layoutZoneSchema).min(1),
  reservedZones: z.array(reservedZoneSchema),
  scorebugState: scorebugStateSchema,
  replayState: replayStateSchema.optional(),
  operatorMode: operatorModeSchema
}) as unknown as z.ZodType<SceneContext>;

export const operatorPlacementPreferenceSchema = z.object({
  requestedZone: layoutZoneSchema.optional(),
  density: densitySchema.optional(),
  force: z.boolean().optional()
});

export const resolvedPlacementSchema: z.ZodType<ResolvedPlacement> = z.object({
  placementId: placementIdSchema,
  objectId: broadcastObjectIdSchema,
  moduleId: z.string().min(1),
  zone: layoutZoneSchema,
  bounds: rectSchema,
  density: densitySchema,
  anchor: placementAnchorSchema,
  collisionPolicy: collisionPolicySchema,
  placementReason: placementReasonSchema,
  stackIndex: z.number().int().nonnegative(),
  zIndex: z.number().int(),
  safeAreaStatus: safeAreaStatusSchema,
  scorebugStatus: scorebugStatusSchema,
  sceneProfile: sceneTypeSchema,
  expiresAt: z.string().datetime({ offset: true }).optional()
}) as unknown as z.ZodType<ResolvedPlacement>;

export const layoutRequestSchema: z.ZodType<LayoutRequest> = z.object({
  object: broadcastObjectSchema,
  resolvedModule: resolvedModuleDefinitionSchema,
  sceneContext: sceneContextSchema,
  outputResolution: sizeSchema,
  activePlacements: z.array(resolvedPlacementSchema),
  reservedZones: z.array(reservedZoneSchema),
  scorebugBounds: rectSchema.optional(),
  operatorPreference: operatorPlacementPreferenceSchema.optional(),
  runtimePriority: broadcastPrioritySchema
}) as unknown as z.ZodType<LayoutRequest>;

export const compoundPlacementSchema = z.object({
  parentPlacement: resolvedPlacementSchema,
  childPlacements: z.array(resolvedPlacementSchema),
  sponsorPlacement: resolvedPlacementSchema.optional(),
  sequence: z.array(broadcastObjectIdSchema).optional(),
  collisionPolicy: collisionPolicySchema
});

export const safeAreaDefinitionSchema = z.object({
  id: z.string().min(1),
  zone: layoutZoneSchema.optional(),
  reservedZone: reservedZoneSchema.optional(),
  bounds: rectSchema,
  protected: z.boolean().optional()
});

export const safeAreaConfigSchema: z.ZodType<SafeAreaConfig> = z.object({
  configVersion: z.string().min(1),
  outputResolution: sizeSchema,
  safeAreas: z.array(safeAreaDefinitionSchema)
}) as unknown as z.ZodType<SafeAreaConfig>;

export function validateSceneContext(input: unknown): ValidationResult<SceneContext> {
  return validateWithSchema(sceneContextSchema, input);
}

export function validateLayoutRequest(input: unknown): ValidationResult<LayoutRequest> {
  return validateWithSchema(layoutRequestSchema, input);
}

export function validateResolvedPlacement(input: unknown): ValidationResult<ResolvedPlacement> {
  return validateWithSchema(resolvedPlacementSchema, input);
}

export function validateSafeAreaConfig(input: unknown): ValidationResult<SafeAreaConfig> {
  return validateWithSchema(safeAreaConfigSchema, input);
}

export function intersectsRect(left: Rect, right: Rect): boolean {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

export function resolvePlacement(input: LayoutRequest): ValidationResult<ResolvedPlacement> {
  const requestValidation = validateLayoutRequest(input);

  if (!requestValidation.success) {
    return requestValidation as ValidationResult<ResolvedPlacement>;
  }

  const request = requestValidation.data;
  const requestedDensity = request.operatorPreference?.density;
  const density = request.resolvedModule.density;
  const densityFallback = requestedDensity !== undefined && requestedDensity !== density;
  const activeZones = new Set(request.sceneContext.activeZones);
  const supportedZones = request.resolvedModule.supportedLayouts.filter((zone) => activeZones.has(zone as LayoutZone)) as LayoutZone[];
  const preferredZone = getPreferredZone(request);
  const candidates = orderCandidateZones(preferredZone, supportedZones);

  for (let index = 0; index < candidates.length; index += 1) {
    const zone = candidates[index] as LayoutZone;
    const bounds = getZoneBounds(zone, request.outputResolution, density);
    const scorebugStatus = getScorebugStatus(bounds, getProtectedScorebugBounds(request));
    const zoneCount = request.activePlacements.filter((placement) => placement.zone === zone).length;
    const capacityBlocked = zoneCount >= zoneCapacity[zone];
    const collisionBlocked = request.activePlacements.some((placement) => intersectsRect(bounds, placement.bounds));

    if (scorebugStatus === 'blocked' || capacityBlocked || collisionBlocked) {
      continue;
    }

    const initialZone = candidates[0] as LayoutZone;
    const placementReason = getPlacementReason({
      request,
      zone,
      initialZone,
      densityFallback,
      index
    });

    const placement: ResolvedPlacement = {
      placementId: `placement_${request.object.id}_${request.resolvedModule.moduleId}` as ResolvedPlacement['placementId'],
      objectId: request.object.id,
      moduleId: request.resolvedModule.moduleId,
      zone,
      bounds,
      density,
      anchor: zoneAnchors[zone],
      collisionPolicy: index === 0 ? 'stack' : 'relocate',
      placementReason,
      stackIndex: zoneCount,
      zIndex: priorityZIndex[request.runtimePriority],
      safeAreaStatus: 'clear',
      scorebugStatus,
      sceneProfile: request.sceneContext.sceneType
    };

    return validateResolvedPlacement(placement);
  }

  return {
    success: false,
    errors: [
      {
        path: 'resolvedPlacement',
        code: 'unplaceable',
        message: 'No valid placement exists for the requested module.'
      }
    ]
  };
}

function getPreferredZone(request: LayoutRequest): LayoutZone {
  if (request.sceneContext.sceneType === 'emergency' && request.resolvedModule.supportedLayouts.includes('Zone F')) {
    return 'Zone F';
  }

  if (request.operatorPreference?.requestedZone !== undefined) {
    return request.operatorPreference.requestedZone;
  }

  return request.resolvedModule.defaultZone as LayoutZone;
}

function orderCandidateZones(preferredZone: LayoutZone, supportedZones: LayoutZone[]): LayoutZone[] {
  const candidates = supportedZones.includes(preferredZone) ? [preferredZone] : [];

  for (const zone of supportedZones) {
    if (!candidates.includes(zone)) {
      candidates.push(zone);
    }
  }

  return candidates;
}

function getProtectedScorebugBounds(request: LayoutRequest): Rect | undefined {
  if (!request.sceneContext.scorebugState.protected || !request.sceneContext.scorebugState.visible) {
    return undefined;
  }

  return request.scorebugBounds ?? request.sceneContext.scorebugState.bounds;
}

function getScorebugStatus(bounds: Rect, scorebugBounds: Rect | undefined): ScorebugStatus {
  if (scorebugBounds === undefined) {
    return 'clear';
  }

  return intersectsRect(bounds, scorebugBounds) ? 'blocked' : 'clear';
}

function getPlacementReason(input: {
  request: LayoutRequest;
  zone: LayoutZone;
  initialZone: LayoutZone;
  densityFallback: boolean;
  index: number;
}): PlacementReason {
  if (input.request.sceneContext.sceneType === 'emergency' && input.zone === 'Zone F') {
    return 'emergency_override';
  }

  if (input.densityFallback) {
    return 'density_fallback';
  }

  const initialBounds = getZoneBounds(input.initialZone, input.request.outputResolution, input.request.resolvedModule.density);
  const initialScorebugStatus = getScorebugStatus(initialBounds, getProtectedScorebugBounds(input.request));
  const initialZoneCount = input.request.activePlacements.filter((placement) => placement.zone === input.initialZone).length;
  const initialCollision = input.request.activePlacements.some((placement) => intersectsRect(initialBounds, placement.bounds));

  if (input.zone !== input.initialZone && initialZoneCount >= zoneCapacity[input.initialZone]) {
    return 'zone_capacity_limit';
  }

  if (input.zone !== input.initialZone && initialScorebugStatus === 'blocked') {
    return 'scorebug_protection';
  }

  if (input.zone !== input.initialZone && initialCollision) {
    return 'collision_relocation';
  }

  if (input.request.operatorPreference?.requestedZone === input.zone && input.request.operatorPreference.force === true) {
    return 'operator_override';
  }

  return input.index === 0 ? 'preferred_zone' : 'collision_relocation';
}

function getZoneBounds(zone: LayoutZone, outputResolution: { width: number; height: number }, density: Density): Rect {
  const scale = density === 'compact' ? 0.78 : density === 'expanded' ? 1.15 : 1;
  const baseWidth = 520 * scale;
  const baseHeight = 180 * scale;
  const margin = 72;
  const bottomY = outputResolution.height - margin - baseHeight;

  switch (zone) {
    case 'Zone A':
      return toRect(margin, margin, baseWidth, baseHeight);
    case 'Zone B':
      return toRect(outputResolution.width - margin - baseWidth, margin, baseWidth, baseHeight);
    case 'Zone C':
      return toRect(margin, bottomY, baseWidth, baseHeight);
    case 'Zone D':
      return toRect((outputResolution.width - 640 * scale) / 2, outputResolution.height - margin - 160 * scale, 640 * scale, 160 * scale);
    case 'Zone E':
      return toRect(outputResolution.width - margin - baseWidth, bottomY, baseWidth, baseHeight);
    case 'Zone F':
      return toRect(240, (outputResolution.height - 220 * scale) / 2, outputResolution.width - 480, 220 * scale);
  }
}

function toRect(x: number, y: number, width: number, height: number): Rect {
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height)
  };
}
