import { EventBus, ObjectStore, StateManager, RuntimeHealthMonitor, RuntimeOrchestrator } from '@quacktrack/runtime';
import { DOMRendererAdapter } from './dom-renderer-adapter';
import type { SceneContext } from '@quacktrack/layout';
import type { SponsorConfig } from '@quacktrack/sponsor-policy';
import type { ModuleRegistryEntry } from '@quacktrack/registry';

export interface OverlayRuntime {
  eventBus: EventBus;
  stateManager: StateManager;
  objectStore: ObjectStore;
  healthMonitor: RuntimeHealthMonitor;
  orchestrator: RuntimeOrchestrator;
  rendererAdapter: DOMRendererAdapter;
}

export function createOverlayRuntime(containerId: string): OverlayRuntime {
  const eventBus = new EventBus();
  const stateManager = new StateManager();
  const objectStore = new ObjectStore();
  const healthMonitor = new RuntimeHealthMonitor();
  const rendererAdapter = new DOMRendererAdapter(containerId);

  const sceneContext: SceneContext = {
    sceneId: 'scene_live' as any,
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
        sponsorName: 'AFLAC INSURANCE',
        sponsorSlot: 'lower-third',
        logoPath: '/logos/aflac.png'
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
      supportedDensities: ['compact', 'standard', 'expanded'],
      defaultDensity: 'standard',
      supportedLayouts: ['Zone C', 'Zone D'],
      defaultZone: 'Zone C',
      componentComposition: { required: ['IdentityNode', 'Label'], optional: [] },
      capabilities: { supportsSponsor: true, supportsLiveUpdate: true },
      lifecycleSupport: ['enter', 'update', 'exit', 'complete'],
      animationProfile: 'identity.standard',
      sponsor: { mode: 'optional', policyKey: 'player' },
      payloadRequirements: { required: ['playerName', 'team'], optional: ['number', 'position'] },
      timing: { duration: 6000 as any, autoHide: true },
      priority: 'normal',
      analyticsCategory: 'person.player',
      fallback: { fallbackBehavior: 'skip' }
    },
    {
      registryVersion: '1.0' as any,
      objectType: 'stat',
      family: 'Performance Context',
      moduleId: 'stat.standard' as any,
      moduleVersion: '1.0' as any,
      moduleName: 'Stat Module',
      moduleStatus: 'production',
      supportedDensities: ['compact', 'standard', 'expanded'],
      defaultDensity: 'standard',
      supportedLayouts: ['Zone C', 'Zone D'],
      defaultZone: 'Zone C',
      componentComposition: { required: ['Label', 'Metric'], optional: [] },
      capabilities: { supportsSponsor: true, supportsLiveUpdate: true },
      lifecycleSupport: ['enter', 'update', 'exit', 'complete'],
      animationProfile: 'data.standard',
      sponsor: { mode: 'optional', policyKey: 'stat' },
      payloadRequirements: { required: ['subjectName', 'primaryMetric'], optional: ['statCategory'] },
      timing: { duration: 7000 as any, autoHide: true },
      priority: 'normal',
      analyticsCategory: 'performance.stat',
      fallback: { fallbackBehavior: 'skip' }
    },
    {
      registryVersion: '1.0' as any,
      objectType: 'sponsor',
      family: 'Commercial Context',
      moduleId: 'sponsor.standard' as any,
      moduleVersion: '1.0' as any,
      moduleName: 'Sponsor Module',
      moduleStatus: 'production',
      supportedDensities: ['compact', 'standard', 'expanded'],
      defaultDensity: 'standard',
      supportedLayouts: ['Zone C', 'Zone D'],
      defaultZone: 'Zone C',
      componentComposition: { required: ['Label'], optional: [] },
      capabilities: { supportsSponsor: true },
      lifecycleSupport: ['enter', 'update', 'exit', 'complete'],
      animationProfile: 'commercial.restrained',
      sponsor: { mode: 'required', policyKey: 'sponsor' },
      payloadRequirements: { required: ['sponsorName'], optional: ['presentationLabel'] },
      timing: { duration: 8000 as any, autoHide: true },
      priority: 'normal',
      analyticsCategory: 'commercial.sponsor',
      fallback: { fallbackBehavior: 'skip' }
    },
    {
      registryVersion: '1.0' as any,
      objectType: 'breaking',
      family: 'Game Context',
      moduleId: 'breaking.standard' as any,
      moduleVersion: '1.0' as any,
      moduleName: 'Breaking Module',
      moduleStatus: 'production',
      supportedDensities: ['compact', 'standard', 'expanded'],
      defaultDensity: 'standard',
      supportedLayouts: ['Zone D'],
      defaultZone: 'Zone D',
      componentComposition: { required: ['Label'], optional: [] },
      capabilities: { supportsSponsor: false },
      lifecycleSupport: ['enter', 'update', 'exit', 'complete'],
      animationProfile: 'alert.fast',
      sponsor: { mode: 'none' },
      payloadRequirements: { required: ['headline'], optional: ['detail'] },
      timing: { duration: 10000 as any, autoHide: true },
      priority: 'high',
      analyticsCategory: 'game.breaking',
      fallback: { fallbackBehavior: 'skip' }
    }
  ];

  const orchestrator = new RuntimeOrchestrator({
    eventBus,
    stateManager,
    objectStore,
    healthMonitor,
    moduleRegistry,
    sponsorConfig,
    sceneContext,
    outputResolution: { width: 1920, height: 1080 },
    rendererAdapter
  });

  return {
    eventBus,
    stateManager,
    objectStore,
    healthMonitor,
    orchestrator,
    rendererAdapter
  };
}
