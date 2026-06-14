import { describe, expect, it } from 'vitest';

import {
  intersectsRect,
  layoutRequestSchema,
  resolvePlacement,
  resolvedPlacementSchema,
  sceneContextSchema,
  validateLayoutRequest,
  validateResolvedPlacement,
  validateSceneContext
} from '..';
import type { Rect, Size } from '@quacktrack/core';
import type { BroadcastObject } from '@quacktrack/objects';
import type { ResolvedModuleDefinition } from '@quacktrack/registry';
import type { LayoutRequest, ResolvedPlacement, SceneContext } from '..';

const outputResolution: Size = { width: 1920, height: 1080 };
const timestamp = '2026-06-13T23:00:00.000Z';

const object = {
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

const sceneContext = {
  sceneId: 'scene_live',
  sceneType: 'live_game',
  outputResolution,
  activeZones: ['Zone A', 'Zone B', 'Zone C', 'Zone D', 'Zone E', 'Zone F'],
  reservedZones: ['scorebug'],
  scorebugState: {
    present: true,
    visible: true,
    protected: true,
    bounds: { x: 1328, y: 72, width: 520, height: 180 }
  },
  operatorMode: 'single_operator'
} as unknown as SceneContext;

const resolvedModule = {
  moduleId: 'player.standard',
  moduleVersion: '1.0',
  registryVersion: '1.0',
  object,
  density: 'standard',
  supportedLayouts: ['Zone C', 'Zone D', 'Zone E', 'Zone F'],
  defaultZone: 'Zone C',
  componentComposition: {
    required: ['IdentityNode', 'Label']
  },
  animationProfile: 'identity.standard',
  lifecycleSupport: ['enter', 'exit', 'complete', 'archive'],
  sponsorMode: 'optional',
  capabilities: {
    supportsSceneOverride: true
  },
  analyticsCategory: 'person.player',
  resolutionReason: 'default_entry'
} as unknown as ResolvedModuleDefinition;

const activePlacementInZoneC = {
  placementId: 'placement_existing',
  objectId: 'obj_existing',
  moduleId: 'player.standard',
  zone: 'Zone C',
  bounds: { x: 72, y: 828, width: 520, height: 180 },
  density: 'standard',
  anchor: 'bottom_left',
  collisionPolicy: 'stack',
  placementReason: 'preferred_zone',
  stackIndex: 0,
  zIndex: 30,
  safeAreaStatus: 'clear',
  scorebugStatus: 'clear',
  sceneProfile: 'live_game'
} as unknown as ResolvedPlacement;

function createRequest(overrides: Partial<LayoutRequest> = {}): LayoutRequest {
  return {
    object,
    resolvedModule,
    sceneContext,
    outputResolution,
    activePlacements: [],
    reservedZones: ['scorebug'],
    runtimePriority: 'normal',
    ...overrides
  } as unknown as LayoutRequest;
}

describe('@quacktrack/layout public API', () => {
  it('validates a valid SceneContext', () => {
    expect(validateSceneContext(sceneContext)).toMatchObject({ success: true });
    expect(sceneContextSchema.safeParse(sceneContext)).toMatchObject({ success: true });
  });

  it('requires LayoutRequest core fields', () => {
    expect(validateLayoutRequest(createRequest())).toMatchObject({ success: true });
    expect(layoutRequestSchema.safeParse({ object })).toMatchObject({ success: false });
  });

  it('requires positive bounds for ResolvedPlacement', () => {
    expect(validateResolvedPlacement(activePlacementInZoneC)).toMatchObject({ success: true });
    expect(
      resolvedPlacementSchema.safeParse({
        ...activePlacementInZoneC,
        bounds: { x: 0, y: 0, width: 0, height: 180 }
      })
    ).toMatchObject({ success: false });
  });

  it('detects rectangle overlap', () => {
    expect(
      intersectsRect(
        { x: 0, y: 0, width: 100, height: 100 },
        { x: 50, y: 50, width: 100, height: 100 }
      )
    ).toBe(true);
    expect(
      intersectsRect(
        { x: 0, y: 0, width: 100, height: 100 },
        { x: 120, y: 120, width: 100, height: 100 }
      )
    ).toBe(false);
  });

  it('uses preferred zone when available', () => {
    const result = resolvePlacement(createRequest());

    expect(result).toMatchObject({
      success: true,
      data: {
        zone: 'Zone C',
        placementReason: 'preferred_zone'
      }
    });
  });

  it('protected scorebug blocks overlapping preferred placement and uses alternate zone', () => {
    const result = resolvePlacement(
      createRequest({
        resolvedModule: {
          ...resolvedModule,
          supportedLayouts: ['Zone B', 'Zone C'],
          defaultZone: 'Zone B'
        } as ResolvedModuleDefinition
      })
    );

    expect(result).toMatchObject({
      success: true,
      data: {
        zone: 'Zone C',
        placementReason: 'scorebug_protection',
        scorebugStatus: 'clear'
      }
    });
  });

  it('relocates when preferred zone collides with active placement', () => {
    const result = resolvePlacement(
      createRequest({
        activePlacements: [activePlacementInZoneC]
      })
    );

    expect(result).toMatchObject({
      success: true,
      data: {
        zone: 'Zone D',
        placementReason: 'collision_relocation',
        collisionPolicy: 'relocate'
      }
    });
  });

  it('records density fallback when requested density differs from resolved module density', () => {
    const result = resolvePlacement(
      createRequest({
        operatorPreference: {
          requestedZone: 'Zone C',
          density: 'expanded'
        }
      })
    );

    expect(result).toMatchObject({
      success: true,
      data: {
        density: 'standard',
        placementReason: 'density_fallback'
      }
    });
  });

  it('emergency scene prefers Zone F', () => {
    const result = resolvePlacement(
      createRequest({
        sceneContext: {
          ...sceneContext,
          sceneType: 'emergency'
        } as SceneContext,
        runtimePriority: 'critical'
      })
    );

    expect(result).toMatchObject({
      success: true,
      data: {
        zone: 'Zone F',
        placementReason: 'emergency_override'
      }
    });
  });

  it('records zone capacity limit when preferred zone is full', () => {
    const activePlacementInZoneD = {
      ...activePlacementInZoneC,
      placementId: 'placement_d',
      zone: 'Zone D',
      bounds: { x: 640, y: 848, width: 640, height: 160 },
      anchor: 'bottom_center'
    } as unknown as ResolvedPlacement;

    const result = resolvePlacement(
      createRequest({
        resolvedModule: {
          ...resolvedModule,
          supportedLayouts: ['Zone D', 'Zone C'],
          defaultZone: 'Zone D'
        } as ResolvedModuleDefinition,
        activePlacements: [activePlacementInZoneD]
      })
    );

    expect(result).toMatchObject({
      success: true,
      data: {
        zone: 'Zone C',
        placementReason: 'zone_capacity_limit'
      }
    });
  });

  it('returns failure when no valid placement exists', () => {
    const activePlacementInZoneD = {
      ...activePlacementInZoneC,
      placementId: 'placement_d',
      zone: 'Zone D',
      bounds: { x: 640, y: 848, width: 640, height: 160 },
      anchor: 'bottom_center'
    } as unknown as ResolvedPlacement;

    const result = resolvePlacement(
      createRequest({
        resolvedModule: {
          ...resolvedModule,
          supportedLayouts: ['Zone D'],
          defaultZone: 'Zone D'
        } as ResolvedModuleDefinition,
        activePlacements: [activePlacementInZoneD]
      })
    );

    expect(result).toMatchObject({
      success: false,
      errors: [{ code: 'unplaceable' }]
    });
  });
});
