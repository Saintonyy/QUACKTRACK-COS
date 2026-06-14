import {
  durationMsSchema,
  moduleIdSchema,
  validateWithSchema,
  versionStringSchema,
  type ValidationIssue,
  type ValidationResult
} from '@quacktrack/core';
import {
  broadcastObjectFamilySchema,
  broadcastObjectSchema,
  broadcastObjectTypeSchema,
  broadcastPrioritySchema,
  densitySchema,
  type BroadcastObject,
  type Density
} from '@quacktrack/objects';
import type { SponsorPolicyDecision } from '@quacktrack/sponsor-policy';
import { z } from 'zod';

import {
  ANIMATION_PROFILES,
  LAYOUT_ZONES,
  LIFECYCLE_SUPPORTS,
  MODULE_RESOLUTION_REASONS,
  MODULE_STATUSES,
  SCENE_TYPES,
  SPONSOR_MODES,
  type AnimationProfile,
  type ComponentComposition,
  type FallbackConfig,
  type LayoutZone,
  type LifecycleSupport,
  type ModuleRegistryConfig,
  type ModuleCapabilities,
  type ModuleRegistryEntry,
  type ModuleResolutionReason,
  type ModuleStatus,
  type ModuleTimingDefaults,
  type PayloadRequirements,
  type RegistrySponsorConfig,
  type ResolveModuleDefinitionInput,
  type ResolvedModuleDefinition,
  type SceneOverride,
  type SceneType,
  type SponsorMode
} from './types';

const densityOrder: Density[] = ['compact', 'standard', 'expanded'];

export const moduleStatusSchema: z.ZodType<ModuleStatus> = z.enum(MODULE_STATUSES);
export const lifecycleSupportSchema: z.ZodType<LifecycleSupport> = z.enum(LIFECYCLE_SUPPORTS);
export const animationProfileSchema: z.ZodType<AnimationProfile> = z.enum(ANIMATION_PROFILES);
export const sponsorModeSchema: z.ZodType<SponsorMode> = z.enum(SPONSOR_MODES);
export const sceneTypeSchema: z.ZodType<SceneType> = z.enum(SCENE_TYPES);
export const layoutZoneSchema: z.ZodType<LayoutZone> = z.enum(LAYOUT_ZONES);
export const moduleResolutionReasonSchema: z.ZodType<ModuleResolutionReason> = z.enum(MODULE_RESOLUTION_REASONS);

export const moduleCapabilitiesSchema: z.ZodType<ModuleCapabilities> = z.object({
  supportsSponsor: z.boolean().optional(),
  supportsLiveUpdate: z.boolean().optional(),
  supportsCompoundParent: z.boolean().optional(),
  supportsCompoundChild: z.boolean().optional(),
  supportsScheduling: z.boolean().optional(),
  supportsSceneOverride: z.boolean().optional(),
  supportsReplay: z.boolean().optional(),
  supportsInterruption: z.boolean().optional()
}) as unknown as z.ZodType<ModuleCapabilities>;

export const componentCompositionSchema: z.ZodType<ComponentComposition> = z.object({
  required: z.array(z.string().min(1)).min(1),
  optional: z.array(z.string().min(1)).optional()
}) as unknown as z.ZodType<ComponentComposition>;

export const payloadRequirementsSchema: z.ZodType<PayloadRequirements> = z.object({
  required: z.array(z.string().min(1)),
  optional: z.array(z.string().min(1)).optional()
}) as unknown as z.ZodType<PayloadRequirements>;

export const moduleTimingDefaultsSchema: z.ZodType<ModuleTimingDefaults> = z.object({
  duration: durationMsSchema.optional(),
  expiresAfter: durationMsSchema.optional(),
  autoHide: z.boolean().optional(),
  manualHoldAllowed: z.boolean().optional()
}) as unknown as z.ZodType<ModuleTimingDefaults>;

export const registrySponsorConfigSchema: z.ZodType<RegistrySponsorConfig> = z.object({
  mode: sponsorModeSchema,
  policyKey: z.string().min(1).optional(),
  lockupRequired: z.boolean().optional()
}) as unknown as z.ZodType<RegistrySponsorConfig>;

export const fallbackConfigSchema: z.ZodType<FallbackConfig> = z.object({
  fallbackModuleId: moduleIdSchema.optional(),
  fallbackBehavior: z.string().min(1).optional()
}) as unknown as z.ZodType<FallbackConfig>;

export const sceneOverrideSchema: z.ZodType<SceneOverride> = z.object({
  density: densitySchema.optional(),
  defaultZone: layoutZoneSchema.optional(),
  supportedLayouts: z.array(layoutZoneSchema).min(1).optional(),
  timing: moduleTimingDefaultsSchema.optional(),
  animationProfile: animationProfileSchema.optional(),
  fallbackModuleId: moduleIdSchema.optional(),
  sponsorMode: sponsorModeSchema.optional()
}) as unknown as z.ZodType<SceneOverride>;

export const moduleRegistryEntrySchema: z.ZodType<ModuleRegistryEntry> = z
  .object({
    registryVersion: versionStringSchema,
    objectType: broadcastObjectTypeSchema,
    family: z.union([broadcastObjectFamilySchema, z.literal('Derived from parent object')]),
    moduleId: moduleIdSchema,
    moduleVersion: versionStringSchema,
    moduleName: z.string().min(1),
    moduleStatus: moduleStatusSchema,
    supportedDensities: z.array(densitySchema).min(1),
    defaultDensity: densitySchema,
    supportedLayouts: z.array(layoutZoneSchema).min(1),
    defaultZone: layoutZoneSchema,
    sceneOverrides: z.record(sceneTypeSchema, sceneOverrideSchema).optional(),
    componentComposition: componentCompositionSchema,
    capabilities: moduleCapabilitiesSchema,
    lifecycleSupport: z.array(lifecycleSupportSchema).min(1),
    animationProfile: animationProfileSchema,
    sponsor: registrySponsorConfigSchema,
    payloadRequirements: payloadRequirementsSchema,
    timing: moduleTimingDefaultsSchema,
    priority: broadcastPrioritySchema,
    analyticsCategory: z.string().min(1),
    fallback: fallbackConfigSchema.optional()
  })
  .superRefine((entry, context) => {
    if (!entry.supportedDensities.includes(entry.defaultDensity)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['defaultDensity'],
        message: 'defaultDensity must be included in supportedDensities.'
      });
    }

    if (!entry.supportedLayouts.includes(entry.defaultZone)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['defaultZone'],
        message: 'defaultZone must be included in supportedLayouts.'
      });
    }
  }) as unknown as z.ZodType<ModuleRegistryEntry>;

export const moduleRegistryConfigSchema: z.ZodType<ModuleRegistryConfig> = z.object({
  registryVersion: versionStringSchema,
  entries: z.array(moduleRegistryEntrySchema)
}) as unknown as z.ZodType<ModuleRegistryConfig>;

export const resolvedModuleDefinitionSchema: z.ZodType<ResolvedModuleDefinition> = z.object({
  moduleId: moduleIdSchema,
  moduleVersion: versionStringSchema,
  registryVersion: versionStringSchema,
  object: broadcastObjectSchema,
  density: densitySchema,
  supportedLayouts: z.array(layoutZoneSchema).min(1),
  defaultZone: layoutZoneSchema,
  componentComposition: componentCompositionSchema,
  animationProfile: animationProfileSchema,
  lifecycleSupport: z.array(lifecycleSupportSchema).min(1),
  sponsorMode: sponsorModeSchema,
  capabilities: moduleCapabilitiesSchema,
  analyticsCategory: z.string().min(1),
  fallbackModuleId: moduleIdSchema.optional(),
  resolutionReason: moduleResolutionReasonSchema
}) as unknown as z.ZodType<ResolvedModuleDefinition>;

export function validateModuleRegistryEntry(input: unknown): ValidationResult<ModuleRegistryEntry> {
  const parsed = validateWithSchema(moduleRegistryEntrySchema, input);

  if (!parsed.success) {
    return parsed;
  }

  const productionIssues = getProductionIssues(parsed.data);

  if (productionIssues.length > 0) {
    return {
      success: false,
      errors: productionIssues
    };
  }

  return parsed;
}

export function validateRegistry(input: unknown): ValidationResult<ModuleRegistryEntry[]> {
  const parsed = validateWithSchema(z.array(moduleRegistryEntrySchema), input);

  if (!parsed.success) {
    return parsed;
  }

  const errors = parsed.data.flatMap((entry, index) =>
    getProductionIssues(entry).map((issue) => ({
      ...issue,
      path: issue.path.length > 0 ? `${index}.${issue.path}` : String(index)
    }))
  );

  if (errors.length > 0) {
    return {
      success: false,
      errors
    };
  }

  return parsed;
}

export function validateModuleRegistryConfig(input: unknown): ValidationResult<ModuleRegistryConfig> {
  const parsed = validateWithSchema(moduleRegistryConfigSchema, input);

  if (!parsed.success) {
    return parsed;
  }

  const registryValidation = validateRegistry(parsed.data.entries);

  if (!registryValidation.success) {
    return {
      success: false,
      errors: registryValidation.errors.map((error) => ({
        ...error,
        path: `entries.${error.path}`
      }))
    };
  }

  return parsed;
}

export function resolveModuleDefinition<TObject extends BroadcastObject>(
  input: ResolveModuleDefinitionInput<TObject>
): ValidationResult<ResolvedModuleDefinition<TObject>> {
  const entry = input.registry.find((candidate) => candidate.objectType === input.object.type);

  if (entry === undefined) {
    return {
      success: false,
      errors: [
        {
          path: 'registry',
          code: 'missing_entry',
          message: `No registry entry exists for object type ${input.object.type}.`
        }
      ]
    };
  }

  const entryValidation = validateModuleRegistryEntry(entry);

  if (!entryValidation.success) {
    return entryValidation as ValidationResult<ResolvedModuleDefinition<TObject>>;
  }

  const sceneOverride = input.sceneType === undefined ? undefined : entry.sceneOverrides?.[input.sceneType];
  const requestedDensity = input.requestedDensity ?? sceneOverride?.density ?? entry.defaultDensity;
  const density = resolveDensity(requestedDensity, entry.supportedDensities);
  const sponsorMode = resolveSponsorMode(sceneOverride?.sponsorMode ?? entry.sponsor.mode, input.sponsorPolicyDecision);
  const fallbackModuleId = sceneOverride?.fallbackModuleId ?? entry.fallback?.fallbackModuleId;
  const resolutionInput: {
    entry: ModuleRegistryEntry;
    requestedDensity: Density;
    density: Density;
    sceneOverride?: SceneOverride;
    sponsorMode: SponsorMode;
  } = {
    entry,
    requestedDensity,
    density,
    sponsorMode
  };

  if (sceneOverride !== undefined) {
    resolutionInput.sceneOverride = sceneOverride;
  }

  const resolutionReason = resolveResolutionReason(resolutionInput);

  const resolved: ResolvedModuleDefinition<TObject> = {
    moduleId: entry.moduleId,
    moduleVersion: entry.moduleVersion,
    registryVersion: entry.registryVersion,
    object: input.object,
    density,
    supportedLayouts: sceneOverride?.supportedLayouts ?? entry.supportedLayouts,
    defaultZone: sceneOverride?.defaultZone ?? entry.defaultZone,
    componentComposition: entry.componentComposition,
    animationProfile: sceneOverride?.animationProfile ?? entry.animationProfile,
    lifecycleSupport: entry.lifecycleSupport,
    sponsorMode,
    capabilities: entry.capabilities,
    analyticsCategory: entry.analyticsCategory,
    resolutionReason
  };

  if (fallbackModuleId !== undefined) {
    resolved.fallbackModuleId = fallbackModuleId;
  }

  if (entry.sponsor.mode === 'required' && sponsorMode === 'suppressed' && fallbackModuleId === undefined) {
    return {
      success: false,
      errors: [
        {
          path: 'sponsor',
          code: 'required_sponsor_suppressed',
          message: 'Required sponsor modules need an explicit fallback when sponsor policy suppresses sponsor.'
        }
      ]
    };
  }

  return validateWithSchema(resolvedModuleDefinitionSchema as z.ZodType<ResolvedModuleDefinition<TObject>>, resolved);
}

function getProductionIssues(entry: ModuleRegistryEntry): ValidationIssue[] {
  if (entry.moduleStatus !== 'production') {
    return [];
  }

  const issues: ValidationIssue[] = [];

  if (entry.registryVersion.length === 0) {
    issues.push({
      path: 'registryVersion',
      code: 'required',
      message: 'Production registry entries require registryVersion.'
    });
  }

  if (entry.moduleVersion.length === 0) {
    issues.push({
      path: 'moduleVersion',
      code: 'required',
      message: 'Production registry entries require moduleVersion.'
    });
  }

  if (entry.supportedLayouts.length === 0) {
    issues.push({
      path: 'supportedLayouts',
      code: 'required',
      message: 'Production registry entries require at least one supported layout.'
    });
  }

  if (entry.fallback === undefined || (entry.fallback.fallbackModuleId === undefined && entry.fallback.fallbackBehavior === undefined)) {
    issues.push({
      path: 'fallback',
      code: 'required',
      message: 'Production registry entries require fallback behavior.'
    });
  }

  if (entry.capabilities.supportsSponsor === true && entry.sponsor.policyKey === undefined) {
    issues.push({
      path: 'sponsor.policyKey',
      code: 'required',
      message: 'Sponsor-compatible production entries require sponsor policyKey.'
    });
  }

  return issues;
}

function resolveDensity(requestedDensity: Density, supportedDensities: Density[]): Density {
  if (supportedDensities.includes(requestedDensity)) {
    return requestedDensity;
  }

  const requestedIndex = densityOrder.indexOf(requestedDensity);

  return supportedDensities
    .slice()
    .sort((left, right) => Math.abs(densityOrder.indexOf(left) - requestedIndex) - Math.abs(densityOrder.indexOf(right) - requestedIndex))[0] as Density;
}

function resolveSponsorMode(
  registryMode: SponsorMode,
  decision: Pick<SponsorPolicyDecision, 'policy' | 'allowed'> | undefined
): SponsorMode {
  if (decision === undefined) {
    return registryMode;
  }

  if (!decision.allowed || decision.policy === 'suppressed') {
    return 'suppressed';
  }

  if (decision.policy === 'required') {
    return 'required';
  }

  return registryMode;
}

function resolveResolutionReason(input: {
  entry: ModuleRegistryEntry;
  requestedDensity: Density;
  density: Density;
  sceneOverride?: SceneOverride;
  sponsorMode: SponsorMode;
}): ModuleResolutionReason {
  if (input.entry.sponsor.mode === 'required' && input.sponsorMode === 'suppressed') {
    return 'sponsor_policy_adjustment';
  }

  if (input.requestedDensity !== input.density) {
    return 'density_fallback';
  }

  if (input.sceneOverride !== undefined) {
    return 'scene_override';
  }

  return 'default_entry';
}
