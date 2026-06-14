import type { DurationMs, ModuleId, VersionString } from '@quacktrack/core';
import type {
  BroadcastObject,
  BroadcastObjectFamily,
  BroadcastObjectType,
  BroadcastPriority,
  Density
} from '@quacktrack/objects';
import type { SponsorPolicyDecision } from '@quacktrack/sponsor-policy';

export const MODULE_STATUSES = ['production', 'future', 'experimental', 'deprecated'] as const;

export type ModuleStatus = (typeof MODULE_STATUSES)[number];

export const LIFECYCLE_SUPPORTS = ['enter', 'update', 'exit', 'interrupt', 'complete', 'archive'] as const;

export type LifecycleSupport = (typeof LIFECYCLE_SUPPORTS)[number];

export const ANIMATION_PROFILES = [
  'identity.standard',
  'data.standard',
  'alert.fast',
  'commercial.restrained',
  'replay.fast',
  'compound.sequence',
  'critical.immediate'
] as const;

export type AnimationProfile = (typeof ANIMATION_PROFILES)[number];

export const SPONSOR_MODES = ['none', 'optional', 'conditional', 'required', 'suppressed'] as const;

export type SponsorMode = (typeof SPONSOR_MODES)[number];

export const SCENE_TYPES = ['live_game', 'replay', 'interview', 'halftime', 'starting_soon', 'postgame', 'emergency'] as const;

export type SceneType = (typeof SCENE_TYPES)[number];

export const LAYOUT_ZONES = ['Zone A', 'Zone B', 'Zone C', 'Zone D', 'Zone E', 'Zone F'] as const;

export type LayoutZone = (typeof LAYOUT_ZONES)[number];

export interface ModuleCapabilities {
  supportsSponsor?: boolean;
  supportsLiveUpdate?: boolean;
  supportsCompoundParent?: boolean;
  supportsCompoundChild?: boolean;
  supportsScheduling?: boolean;
  supportsSceneOverride?: boolean;
  supportsReplay?: boolean;
  supportsInterruption?: boolean;
}

export interface ComponentComposition {
  required: string[];
  optional?: string[];
}

export interface PayloadRequirements {
  required: string[];
  optional?: string[];
}

export interface ModuleTimingDefaults {
  duration?: DurationMs;
  expiresAfter?: DurationMs;
  autoHide?: boolean;
  manualHoldAllowed?: boolean;
}

export interface RegistrySponsorConfig {
  mode: SponsorMode;
  policyKey?: string;
  lockupRequired?: boolean;
}

export interface FallbackConfig {
  fallbackModuleId?: ModuleId;
  fallbackBehavior?: string;
}

export interface SceneOverride {
  density?: Density;
  defaultZone?: LayoutZone;
  supportedLayouts?: LayoutZone[];
  timing?: ModuleTimingDefaults;
  animationProfile?: AnimationProfile;
  fallbackModuleId?: ModuleId;
  sponsorMode?: SponsorMode;
}

export interface ModuleRegistryEntry {
  registryVersion: VersionString;
  objectType: BroadcastObjectType;
  family: BroadcastObjectFamily | 'Derived from parent object';
  moduleId: ModuleId;
  moduleVersion: VersionString;
  moduleName: string;
  moduleStatus: ModuleStatus;
  supportedDensities: Density[];
  defaultDensity: Density;
  supportedLayouts: LayoutZone[];
  defaultZone: LayoutZone;
  sceneOverrides?: Partial<Record<SceneType, SceneOverride>>;
  componentComposition: ComponentComposition;
  capabilities: ModuleCapabilities;
  lifecycleSupport: LifecycleSupport[];
  animationProfile: AnimationProfile;
  sponsor: RegistrySponsorConfig;
  payloadRequirements: PayloadRequirements;
  timing: ModuleTimingDefaults;
  priority: BroadcastPriority;
  analyticsCategory: string;
  fallback?: FallbackConfig;
}

export interface ModuleRegistryConfig {
  registryVersion: VersionString;
  entries: ModuleRegistryEntry[];
}

export const MODULE_RESOLUTION_REASONS = [
  'default_entry',
  'scene_override',
  'density_fallback',
  'sponsor_policy_adjustment',
  'fallback_module',
  'operator_preference',
  'compound_resolution'
] as const;

export type ModuleResolutionReason = (typeof MODULE_RESOLUTION_REASONS)[number];

export interface ResolvedModuleDefinition<TObject extends BroadcastObject = BroadcastObject> {
  moduleId: ModuleId;
  moduleVersion: VersionString;
  registryVersion: VersionString;
  object: TObject;
  density: Density;
  supportedLayouts: LayoutZone[];
  defaultZone: LayoutZone;
  componentComposition: ComponentComposition;
  animationProfile: AnimationProfile;
  lifecycleSupport: LifecycleSupport[];
  sponsorMode: SponsorMode;
  capabilities: ModuleCapabilities;
  analyticsCategory: string;
  fallbackModuleId?: ModuleId;
  resolutionReason: ModuleResolutionReason;
}

export interface ResolveModuleDefinitionInput<TObject extends BroadcastObject = BroadcastObject> {
  object: TObject;
  registry: ModuleRegistryEntry[];
  requestedDensity?: Density;
  sceneType?: SceneType;
  sponsorPolicyDecision?: Pick<SponsorPolicyDecision, 'policy' | 'allowed'>;
}
