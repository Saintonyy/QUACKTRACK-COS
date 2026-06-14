import { describe, expect, it } from 'vitest';

import {
  moduleRegistryEntrySchema,
  resolveModuleDefinition,
  resolvedModuleDefinitionSchema,
  validateModuleRegistryEntry,
  validateRegistry
} from '..';
import type { BroadcastObject } from '@quacktrack/objects';
import type { ModuleRegistryEntry } from '..';
import type { ModuleId } from '@quacktrack/core';

const timestamp = '2026-06-13T23:00:00.000Z';

const playerObject = {
  id: 'obj_player',
  objectVersion: 1,
  schemaVersion: '1.0',
  type: 'player',
  family: 'Person Context',
  lifecycle: 'VALIDATED',
  priority: 'normal',
  payload: {
    playerName: 'Alex Rivera',
    team: 'QUACKTRACK'
  },
  analytics: {
    impressions: 0,
    displayTime: 0,
    interruptionCount: 0
  },
  source: {
    eventId: 'evt_player',
    eventName: 'PLAYER_INTRODUCTION',
    source: 'operator_panel',
    sourceType: 'human',
    timestamp
  },
  createdAt: timestamp
} as unknown as BroadcastObject;

const playerEntry = {
  registryVersion: '1.0',
  objectType: 'player',
  family: 'Person Context',
  moduleId: 'player.standard',
  moduleVersion: '1.0',
  moduleName: 'Player Module',
  moduleStatus: 'production',
  supportedDensities: ['compact', 'standard'],
  defaultDensity: 'standard',
  supportedLayouts: ['Zone C', 'Zone D'],
  defaultZone: 'Zone C',
  sceneOverrides: {
    replay: {
      density: 'compact',
      defaultZone: 'Zone D',
      supportedLayouts: ['Zone D'],
      animationProfile: 'replay.fast'
    }
  },
  componentComposition: {
    required: ['IdentityNode', 'Label'],
    optional: ['Metric', 'SponsorLockup']
  },
  capabilities: {
    supportsSponsor: true,
    supportsLiveUpdate: true,
    supportsSceneOverride: true,
    supportsInterruption: true
  },
  lifecycleSupport: ['enter', 'update', 'exit', 'interrupt', 'complete', 'archive'],
  animationProfile: 'identity.standard',
  sponsor: {
    mode: 'optional',
    policyKey: 'player'
  },
  payloadRequirements: {
    required: ['playerName', 'team'],
    optional: ['number', 'position', 'metrics']
  },
  timing: {
    duration: 6000,
    autoHide: true
  },
  priority: 'normal',
  analyticsCategory: 'person.player',
  fallback: {
    fallbackModuleId: 'label.compact',
    fallbackBehavior: 'render name and team only'
  }
} as unknown as ModuleRegistryEntry;

const sponsorEntry = {
  ...playerEntry,
  objectType: 'sponsor',
  family: 'Commercial Context',
  moduleId: 'sponsor.standard',
  moduleName: 'Sponsor Module',
  sponsor: {
    mode: 'required',
    policyKey: 'sponsor'
  },
  capabilities: {
    supportsSponsor: true,
    supportsScheduling: true
  },
  analyticsCategory: 'commercial.sponsor',
  fallback: undefined
} as unknown as ModuleRegistryEntry;

const sponsorObject = {
  ...playerObject,
  id: 'obj_sponsor',
  type: 'sponsor',
  family: 'Commercial Context',
  priority: 'low',
  payload: {
    sponsorName: 'Acme Sports',
    sponsorSlot: 'lower-third',
    sponsorId: 'sp_001'
  }
} as unknown as BroadcastObject;

describe('@quacktrack/registry public API', () => {
  it('requires registryVersion for production entries', () => {
    const { registryVersion: _registryVersion, ...withoutRegistryVersion } = playerEntry as unknown as Record<
      string,
      unknown
    >;

    expect(moduleRegistryEntrySchema.safeParse(withoutRegistryVersion)).toMatchObject({ success: false });
  });

  it('requires moduleVersion for production entries', () => {
    const { moduleVersion: _moduleVersion, ...withoutModuleVersion } = playerEntry as unknown as Record<
      string,
      unknown
    >;

    expect(moduleRegistryEntrySchema.safeParse(withoutModuleVersion)).toMatchObject({ success: false });
  });

  it('fails resolution when registry entry is missing', () => {
    expect(resolveModuleDefinition({ object: playerObject, registry: [] })).toMatchObject({
      success: false,
      errors: [{ code: 'missing_entry' }]
    });
  });

  it('falls back when requested density is unsupported', () => {
    const result = resolveModuleDefinition({
      object: playerObject,
      registry: [playerEntry],
      requestedDensity: 'expanded'
    });

    expect(result).toMatchObject({
      success: true,
      data: {
        density: 'standard',
        resolutionReason: 'density_fallback'
      }
    });
  });

  it('applies scene override density and zone', () => {
    const result = resolveModuleDefinition({
      object: playerObject,
      registry: [playerEntry],
      sceneType: 'replay'
    });

    expect(result).toMatchObject({
      success: true,
      data: {
        density: 'compact',
        defaultZone: 'Zone D',
        supportedLayouts: ['Zone D'],
        animationProfile: 'replay.fast',
        resolutionReason: 'scene_override'
      }
    });
  });

  it('does not let scene override change object type', () => {
    const result = resolveModuleDefinition({
      object: playerObject,
      registry: [playerEntry],
      sceneType: 'replay'
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.object.type).toBe('player');
    }
  });

  it('fails required sponsor module when sponsor policy suppresses without fallback', () => {
    const result = resolveModuleDefinition({
      object: sponsorObject,
      registry: [
        {
          ...sponsorEntry,
          moduleStatus: 'experimental'
        } as ModuleRegistryEntry
      ],
      sponsorPolicyDecision: {
        policy: 'suppressed',
        allowed: false
      }
    });

    expect(result).toMatchObject({
      success: false,
      errors: [{ code: 'required_sponsor_suppressed' }]
    });
  });

  it('allows required sponsor module to resolve with fallback when policy suppresses', () => {
    const result = resolveModuleDefinition({
      object: sponsorObject,
      registry: [
        {
          ...sponsorEntry,
          fallback: {
            fallbackModuleId: 'label.compact' as ModuleId
          }
        }
      ],
      sponsorPolicyDecision: {
        policy: 'suppressed',
        allowed: false
      }
    });

    expect(result).toMatchObject({
      success: true,
      data: {
        sponsorMode: 'suppressed',
        fallbackModuleId: 'label.compact',
        resolutionReason: 'sponsor_policy_adjustment'
      }
    });
  });

  it('does not treat future entries as production validation', () => {
    const futureEntry = {
      ...playerEntry,
      moduleStatus: 'future',
      fallback: undefined,
      sponsor: {
        mode: 'optional'
      }
    };

    expect(validateModuleRegistryEntry(futureEntry)).toMatchObject({ success: true });
    expect(validateRegistry([futureEntry])).toMatchObject({ success: true });
  });

  it('resolves full module definition shape', () => {
    const result = resolveModuleDefinition({
      object: playerObject,
      registry: [playerEntry]
    });

    expect(result).toMatchObject({
      success: true,
      data: {
        moduleId: 'player.standard',
        moduleVersion: '1.0',
        registryVersion: '1.0',
        object: playerObject,
        density: 'standard',
        supportedLayouts: ['Zone C', 'Zone D'],
        defaultZone: 'Zone C',
        componentComposition: playerEntry.componentComposition,
        animationProfile: 'identity.standard',
        lifecycleSupport: ['enter', 'update', 'exit', 'interrupt', 'complete', 'archive'],
        sponsorMode: 'optional',
        capabilities: playerEntry.capabilities,
        analyticsCategory: 'person.player',
        fallbackModuleId: 'label.compact',
        resolutionReason: 'default_entry'
      }
    });

    if (result.success) {
      expect(resolvedModuleDefinitionSchema.safeParse(result.data)).toMatchObject({ success: true });
    }
  });
});
