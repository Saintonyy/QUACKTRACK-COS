import { describe, expect, it } from 'vitest';

import {
  renderResolvedModule,
  rendererInputSchema,
  rendererResultSchema,
  validateRendererInput
} from '..';
import type { ISODateTime } from '@quacktrack/core';
import type { RendererInput } from '..';

const timestamp = '2026-06-13T23:00:00.000Z' as ISODateTime;

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
};

const input = {
  resolvedModule: {
    moduleId: 'player.standard',
    moduleVersion: '1.0',
    registryVersion: '1.0',
    object,
    density: 'standard',
    supportedLayouts: ['Zone C', 'Zone D'],
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
  },
  placement: {
    placementId: 'placement_001',
    objectId: 'obj_player',
    moduleId: 'player.standard',
    zone: 'Zone C',
    bounds: {
      x: 72,
      y: 828,
      width: 520,
      height: 180
    },
    density: 'standard',
    anchor: 'bottom_left',
    collisionPolicy: 'stack',
    placementReason: 'preferred_zone',
    stackIndex: 0,
    zIndex: 30,
    safeAreaStatus: 'clear',
    scorebugStatus: 'clear',
    sceneProfile: 'live_game'
  }
} as unknown as RendererInput;

describe('@quacktrack/renderer public API', () => {
  it('requires resolvedModule and placement', () => {
    expect(validateRendererInput(input)).toMatchObject({ success: true });
    expect(rendererInputSchema.safeParse({ placement: input.placement })).toMatchObject({ success: false });
    expect(rendererInputSchema.safeParse({ resolvedModule: input.resolvedModule })).toMatchObject({ success: false });
  });

  it('rejects raw EventEnvelope-like input', () => {
    expect(
      validateRendererInput({
        id: 'evt_001',
        name: 'PLAYER_INTRODUCTION',
        source: 'operator_panel',
        sourceType: 'human',
        timestamp,
        payload: {
          playerName: 'Alex Rivera',
          team: 'QUACKTRACK'
        }
      })
    ).toMatchObject({ success: false });
  });

  it('rejects placement with non-positive bounds', () => {
    expect(
      validateRendererInput({
        ...input,
        placement: {
          ...input.placement,
          bounds: {
            x: 72,
            y: 828,
            width: 0,
            height: 180
          }
        }
      })
    ).toMatchObject({ success: false });
  });

  it('represents success and failure renderer results', () => {
    expect(
      rendererResultSchema.safeParse({
        success: true,
        moduleId: 'player.standard',
        placementId: 'placement_001',
        timestamp
      })
    ).toMatchObject({ success: true });

    expect(
      rendererResultSchema.safeParse({
        success: false,
        error: {
          code: 'RENDERER_INVALID_INPUT',
          message: 'Invalid renderer input.',
          recoverable: true,
          timestamp
        }
      })
    ).toMatchObject({ success: true });
  });

  it('returns success for valid resolved input', () => {
    expect(renderResolvedModule(input, timestamp)).toEqual({
      success: true,
      moduleId: 'player.standard',
      placementId: 'placement_001',
      timestamp
    });
  });

  it('returns failure with recoverable flag and error code for invalid input', () => {
    expect(renderResolvedModule({ placement: input.placement }, timestamp)).toMatchObject({
      success: false,
      error: {
        code: 'RENDERER_INVALID_INPUT',
        recoverable: true,
        timestamp
      }
    });
  });
});
