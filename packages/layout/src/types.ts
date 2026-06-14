import type { BroadcastObjectId, ISODateTime, PlacementId, Rect, SceneId, Size } from '@quacktrack/core';
import type { BroadcastObject, BroadcastPriority, Density } from '@quacktrack/objects';
import type { ResolvedModuleDefinition } from '@quacktrack/registry';

export const SCENE_TYPES = ['live_game', 'replay', 'interview', 'halftime', 'starting_soon', 'postgame', 'emergency'] as const;

export type SceneType = (typeof SCENE_TYPES)[number];

export const LAYOUT_ZONES = ['Zone A', 'Zone B', 'Zone C', 'Zone D', 'Zone E', 'Zone F'] as const;

export type LayoutZone = (typeof LAYOUT_ZONES)[number];

export const RESERVED_ZONES = ['scorebug', 'clock', 'downDistance', 'networkBug', 'replayBug', 'emergencyBanner'] as const;

export type ReservedZone = (typeof RESERVED_ZONES)[number];

export interface ScorebugState {
  present: boolean;
  visible: boolean;
  bounds?: Rect;
  protected: boolean;
}

export interface ReplayState {
  active: boolean;
  replayId?: string;
  angleLabel?: string;
}

export const OPERATOR_MODES = ['local', 'remote', 'single_operator', 'multi_operator', 'read_only', 'takeover'] as const;

export type OperatorMode = (typeof OPERATOR_MODES)[number];

export interface SceneContext {
  sceneId: SceneId;
  sceneType: SceneType;
  outputResolution: Size;
  activeZones: LayoutZone[];
  reservedZones: ReservedZone[];
  scorebugState: ScorebugState;
  replayState?: ReplayState;
  operatorMode: OperatorMode;
}

export const COLLISION_POLICIES = ['replace', 'stack', 'queue', 'reject', 'compact', 'relocate'] as const;

export type CollisionPolicy = (typeof COLLISION_POLICIES)[number];

export const SAFE_AREA_STATUSES = ['clear', 'near', 'blocked', 'override_requested', 'override_rejected'] as const;

export type SafeAreaStatus = (typeof SAFE_AREA_STATUSES)[number];

export const SCOREBUG_STATUSES = ['clear', 'near', 'blocked', 'override_requested', 'override_rejected'] as const;

export type ScorebugStatus = (typeof SCOREBUG_STATUSES)[number];

export interface OperatorPlacementPreference {
  requestedZone?: LayoutZone;
  density?: Density;
  force?: boolean;
}

export interface LayoutRequest<TObject extends BroadcastObject = BroadcastObject> {
  object: TObject;
  resolvedModule: ResolvedModuleDefinition<TObject>;
  sceneContext: SceneContext;
  outputResolution: Size;
  activePlacements: ResolvedPlacement[];
  reservedZones: ReservedZone[];
  scorebugBounds?: Rect;
  operatorPreference?: OperatorPlacementPreference;
  runtimePriority: BroadcastPriority;
}

export const PLACEMENT_ANCHORS = [
  'top_left',
  'top_right',
  'bottom_left',
  'bottom_right',
  'bottom_center',
  'center',
  'full_width'
] as const;

export type PlacementAnchor = (typeof PLACEMENT_ANCHORS)[number];

export const PLACEMENT_REASONS = [
  'preferred_zone',
  'collision_relocation',
  'scorebug_protection',
  'scene_override',
  'density_fallback',
  'operator_override',
  'zone_capacity_limit',
  'emergency_override'
] as const;

export type PlacementReason = (typeof PLACEMENT_REASONS)[number];

export interface ResolvedPlacement {
  placementId: PlacementId;
  objectId: BroadcastObjectId;
  moduleId: ResolvedModuleDefinition['moduleId'];
  zone: LayoutZone;
  bounds: Rect;
  density: Density;
  anchor: PlacementAnchor;
  collisionPolicy: CollisionPolicy;
  placementReason: PlacementReason;
  stackIndex: number;
  zIndex: number;
  safeAreaStatus: SafeAreaStatus;
  scorebugStatus: ScorebugStatus;
  sceneProfile: SceneType;
  expiresAt?: ISODateTime;
}

export interface CompoundPlacement {
  parentPlacement: ResolvedPlacement;
  childPlacements: ResolvedPlacement[];
  sponsorPlacement?: ResolvedPlacement;
  sequence?: BroadcastObjectId[];
  collisionPolicy: CollisionPolicy;
}

export interface SafeAreaDefinition {
  id: string;
  zone?: LayoutZone;
  reservedZone?: ReservedZone;
  bounds: Rect;
  protected?: boolean;
}

export interface SafeAreaConfig {
  configVersion: string;
  outputResolution: Size;
  safeAreas: SafeAreaDefinition[];
}
