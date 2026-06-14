import { describe, expect, it } from 'vitest';
import { EventBus } from '../event-bus';
import { StateManager } from '../state-manager';
import { ObjectStore } from '../object-store';
import { RuntimeHealthMonitor } from '../health-monitor';
import { RuntimeOrchestrator } from '../orchestrator';
import { InMemoryAnalyticsWriter } from '@quacktrack/analytics';
import type { EventEnvelope } from '@quacktrack/events';
import type { ISODateTime } from '@quacktrack/core';
import type { SceneContext } from '@quacktrack/layout';
import type { SponsorConfig } from '@quacktrack/sponsor-policy';
import type { ModuleRegistryEntry } from '@quacktrack/registry';

const now = '2026-06-13T23:00:00.000Z' as ISODateTime;

const sceneContext: SceneContext = {
  sceneId: 'scene_001' as any,
  sceneType: 'live_game',
  outputResolution: { width: 1920, height: 1080 },
  activeZones: ['Zone A', 'Zone B', 'Zone C', 'Zone D', 'Zone E', 'Zone F'],
  reservedZones: [],
  scorebugState: {
    present: true,
    visible: true,
    bounds: { x: 100, y: 100, width: 300, height: 80 },
    protected: true
  },
  operatorMode: 'single_operator'
};

const sponsorConfig: SponsorConfig = {
  configVersion: '1.0',
  enabled: true,
  defaultDisplayMode: 'logo',
  requireLogoForDisplay: false,
  policyByObjectType: {
    player: 'permitted',
    stat: 'permitted',
    sponsor: 'required',
    breaking: 'conditional'
  },
  sponsors: [
    {
      sponsorId: 'sp_001' as any,
      sponsorName: 'Acme Sports',
      sponsorSlot: 'lower-third',
      logoPath: '/logos/acme.png'
    }
  ],
  campaigns: []
};

const moduleRegistry: ModuleRegistryEntry[] = [
  {
    registryVersion: '1.0' as any,
    objectType: 'player',
    family: 'Person Context',
    moduleId: 'player.standard' as any,
    moduleVersion: '1.0' as any,
    moduleName: 'Player Module',
    moduleStatus: 'production',
    supportedDensities: ['compact', 'standard'],
    defaultDensity: 'standard',
    supportedLayouts: ['Zone C', 'Zone D'],
    defaultZone: 'Zone C',
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
      duration: 6000 as any,
      autoHide: true
    },
    priority: 'normal',
    analyticsCategory: 'person.player',
    fallback: {
      fallbackModuleId: 'label.compact' as any,
      fallbackBehavior: 'render name and team only'
    }
  },
  {
    registryVersion: '1.0' as any,
    objectType: 'stat',
    family: 'Performance Context',
    moduleId: 'stat.standard' as any,
    moduleVersion: '1.0' as any,
    moduleName: 'Stat Module',
    moduleStatus: 'production',
    supportedDensities: ['compact', 'standard'],
    defaultDensity: 'standard',
    supportedLayouts: ['Zone C', 'Zone D'],
    defaultZone: 'Zone C',
    componentComposition: {
      required: ['Label', 'Metric'],
      optional: ['SponsorLockup']
    },
    capabilities: {
      supportsSponsor: true,
      supportsLiveUpdate: true,
      supportsSceneOverride: true,
      supportsInterruption: true
    },
    lifecycleSupport: ['enter', 'update', 'exit', 'interrupt', 'complete', 'archive'],
    animationProfile: 'data.standard',
    sponsor: {
      mode: 'optional',
      policyKey: 'stat'
    },
    payloadRequirements: {
      required: ['playerName', 'primaryMetric'],
      optional: ['number', 'position', 'metrics']
    },
    timing: {
      duration: 7000 as any,
      autoHide: true
    },
    priority: 'normal',
    analyticsCategory: 'performance.stat',
    fallback: {
      fallbackModuleId: 'label.compact' as any,
      fallbackBehavior: 'render name and metric'
    }
  },
  {
    registryVersion: '1.0' as any,
    objectType: 'sponsor',
    family: 'Commercial Context',
    moduleId: 'sponsor.standard' as any,
    moduleVersion: '1.0' as any,
    moduleName: 'Sponsor Module',
    moduleStatus: 'production',
    supportedDensities: ['compact', 'standard'],
    defaultDensity: 'standard',
    supportedLayouts: ['Zone C', 'Zone D'],
    defaultZone: 'Zone C',
    componentComposition: {
      required: ['SponsorLockup'],
      optional: []
    },
    capabilities: {
      supportsSponsor: true,
      supportsLiveUpdate: true,
      supportsSceneOverride: true,
      supportsInterruption: true
    },
    lifecycleSupport: ['enter', 'update', 'exit', 'interrupt', 'complete', 'archive'],
    animationProfile: 'commercial.restrained',
    sponsor: {
      mode: 'required',
      policyKey: 'sponsor'
    },
    payloadRequirements: {
      required: ['sponsorName', 'sponsorSlot'],
      optional: ['logoPath', 'campaignId']
    },
    timing: {
      duration: 8000 as any,
      autoHide: true
    },
    priority: 'normal',
    analyticsCategory: 'commercial.sponsor',
    fallback: {
      fallbackModuleId: 'label.compact' as any,
      fallbackBehavior: 'render name only'
    }
  },
  {
    registryVersion: '1.0' as any,
    objectType: 'breaking',
    family: 'Game Context',
    moduleId: 'breaking.standard' as any,
    moduleVersion: '1.0' as any,
    moduleName: 'Breaking Module',
    moduleStatus: 'production',
    supportedDensities: ['compact', 'standard'],
    defaultDensity: 'standard',
    supportedLayouts: ['Zone C', 'Zone D'],
    defaultZone: 'Zone C',
    componentComposition: {
      required: ['Label'],
      optional: []
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
      policyKey: 'breaking'
    },
    payloadRequirements: {
      required: ['headline'],
      optional: ['detail', 'severity']
    },
    timing: {
      duration: 5000 as any,
      autoHide: true
    },
    priority: 'high',
    analyticsCategory: 'game.breaking',
    fallback: {
      fallbackModuleId: 'label.compact' as any,
      fallbackBehavior: 'render headline only'
    }
  }
];

function setupOrchestrator() {
  const eventBus = new EventBus();
  const stateManager = new StateManager({ state: 'READY' });
  const objectStore = new ObjectStore();
  const healthMonitor = new RuntimeHealthMonitor();
  const analyticsWriter = new InMemoryAnalyticsWriter();

  const orchestrator = new RuntimeOrchestrator({
    eventBus,
    stateManager,
    objectStore,
    healthMonitor,
    moduleRegistry,
    sponsorConfig,
    sceneContext,
    outputResolution: { width: 1920, height: 1080 },
    analyticsWriter
  });

  return { orchestrator, eventBus, stateManager, objectStore, healthMonitor, analyticsWriter };
}

describe('RuntimeOrchestrator', () => {
  it('should process PLAYER_INTRODUCTION successfully end-to-end', () => {
    const { orchestrator } = setupOrchestrator();

    const event: EventEnvelope = {
      id: 'evt_intro_001' as any,
      name: 'PLAYER_INTRODUCTION',
      source: 'operator_panel',
      sourceType: 'human',
      timestamp: now,
      payload: {
        playerName: 'Alex Rivera',
        team: 'QUACKTRACK'
      }
    };

    const result = orchestrator.processEvent(event);

    expect(result.accepted).toBe(true);
    expect(result.object).toBeDefined();
    expect(result.object!.type).toBe('player');
    expect(result.object!.objectVersion).toBe(1);

    expect(result.queueItem).toBeDefined();
    expect(result.queueItem!.status).toBe('active');

    expect(result.resolvedModule).toBeDefined();
    expect(result.resolvedModule!.moduleId).toBe('player.standard');

    expect(result.resolvedPlacement).toBeDefined();
    expect(result.resolvedPlacement!.zone).toBe('Zone C');

    expect(result.rendererResult).toBeDefined();
    expect(result.rendererResult!.success).toBe(true);

    expect(result.analyticsRecords).toHaveLength(3); // event.accepted, object.created, object.visible
    expect(result.errors).toBeUndefined();
  });

  it('should process PLAYER_STAT successfully', () => {
    const { orchestrator } = setupOrchestrator();

    const event: EventEnvelope = {
      id: 'evt_stat_001' as any,
      name: 'PLAYER_STAT',
      source: 'operator_panel',
      sourceType: 'human',
      timestamp: now,
      payload: {
        playerName: 'Alex Rivera',
        primaryMetric: {
          value: '30 PTS',
          label: 'Points Scored'
        }
      }
    };

    const result = orchestrator.processEvent(event);
    expect(result.accepted).toBe(true);
    expect(result.object!.type).toBe('stat');
    expect(result.resolvedModule!.moduleId).toBe('stat.standard');
    expect(result.rendererResult!.success).toBe(true);
  });

  it('should process SPONSOR_MOMENT successfully', () => {
    const { orchestrator } = setupOrchestrator();

    const event: EventEnvelope = {
      id: 'evt_sponsor_001' as any,
      name: 'SPONSOR_MOMENT',
      source: 'operator_panel',
      sourceType: 'human',
      timestamp: now,
      payload: {
        sponsorId: 'sp_001',
        sponsorName: 'Acme Sports',
        sponsorSlot: 'lower-third'
      }
    };

    const result = orchestrator.processEvent(event);
    expect(result.accepted).toBe(true);
    expect(result.object!.type).toBe('sponsor');
    expect(result.object!.sponsor!.sponsorId).toBe('sp_001');
    expect(result.resolvedModule!.moduleId).toBe('sponsor.standard');
  });

  it('should process BREAKING_UPDATE successfully', () => {
    const { orchestrator } = setupOrchestrator();

    const event: EventEnvelope = {
      id: 'evt_breaking_001' as any,
      name: 'BREAKING_UPDATE',
      source: 'operator_panel',
      sourceType: 'human',
      timestamp: now,
      payload: {
        headline: 'Touchdown Quacktrack!'
      }
    };

    const result = orchestrator.processEvent(event);
    expect(result.accepted).toBe(true);
    expect(result.object!.type).toBe('breaking');
  });

  it('should process COS_HIDE successfully', () => {
    const { orchestrator } = setupOrchestrator();

    // Show first
    orchestrator.processEvent({
      id: 'evt_intro_001' as any,
      name: 'PLAYER_INTRODUCTION',
      source: 'operator_panel',
      sourceType: 'human',
      timestamp: now,
      payload: { playerName: 'Alex Rivera', team: 'QUACKTRACK' }
    });

    // Hide it
    const result = orchestrator.processEvent({
      id: 'evt_hide_001' as any,
      name: 'COS_HIDE',
      source: 'operator_panel',
      sourceType: 'human',
      timestamp: now,
      payload: {}
    });

    expect(result.accepted).toBe(true);
    expect(result.analyticsRecords).toHaveLength(2); // event.accepted, object.completed
  });

  it('should process QUEUE_NEXT successfully', () => {
    const { orchestrator } = setupOrchestrator();

    // Process one which becomes active immediately
    orchestrator.processEvent({
      id: 'evt_intro_001' as any,
      name: 'PLAYER_INTRODUCTION',
      source: 'operator_panel',
      sourceType: 'human',
      timestamp: now,
      payload: { playerName: 'Alex Rivera', team: 'QUACKTRACK' }
    });

    // Process another which gets queued (since active is occupied and same priority does not preempt)
    orchestrator.processEvent({
      id: 'evt_stat_001' as any,
      name: 'PLAYER_STAT',
      source: 'operator_panel',
      sourceType: 'human',
      timestamp: now,
      payload: {
        playerName: 'Alex Rivera',
        primaryMetric: { value: '30 PTS', label: 'Points' }
      }
    });

    // Trigger QUEUE_NEXT
    const result = orchestrator.processEvent({
      id: 'evt_next_001' as any,
      name: 'QUEUE_NEXT',
      source: 'operator_panel',
      sourceType: 'human',
      timestamp: now,
      payload: {}
    });

    expect(result.accepted).toBe(true);
    expect(result.queueItem!.status).toBe('active');
    expect(result.object!.type).toBe('stat');
  });

  it('should process EMERGENCY_CLEAR successfully and transition StateManager status', () => {
    const { orchestrator, stateManager } = setupOrchestrator();

    // Show first
    orchestrator.processEvent({
      id: 'evt_intro_001' as any,
      name: 'PLAYER_INTRODUCTION',
      source: 'operator_panel',
      sourceType: 'human',
      timestamp: now,
      payload: { playerName: 'Alex Rivera', team: 'QUACKTRACK' }
    });

    // emergency clear
    const result = orchestrator.processEvent({
      id: 'evt_clear_001' as any,
      name: 'EMERGENCY_CLEAR',
      source: 'operator_panel',
      sourceType: 'human',
      timestamp: now,
      payload: {}
    });

    expect(result.accepted).toBe(true);
    expect(stateManager.getState().state).toBe('EMERGENCY');
  });
});
