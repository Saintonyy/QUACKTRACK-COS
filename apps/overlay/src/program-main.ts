import { validateEventEnvelope } from '@quacktrack/events';
import { createOverlayRuntime } from './create-runtime';

// 1. Boot independent overlay runtime foundation
const { eventBus, stateManager, objectStore, healthMonitor, orchestrator } = createOverlayRuntime('program-canvas');

// Initialize State to LIVE (independent bootstrap)
healthMonitor.recordQueueDepth(0);
stateManager.updateHealth({
  overall: 'healthy',
  eventBus: 'healthy',
  queueEngine: 'healthy',
  moduleRegistry: 'healthy',
  layoutEngine: 'healthy',
  renderer: 'healthy',
  sponsorPolicy: 'healthy',
  analytics: 'healthy',
  obsConnection: 'healthy'
});
stateManager.transitionTo('READY');
stateManager.transitionTo('LIVE');

// 2. StateManager Subscription (Handles canvas hide/clear transitions)
let autoHideTimer: any = null;

stateManager.subscribe((state) => {
  const canvas = document.getElementById('program-canvas');
  if (!canvas) return;

  if (state.state === 'EMERGENCY') {
    canvas.innerHTML = '';
    canvas.style.opacity = '0';
  } else if (!state.visible) {
    canvas.style.opacity = '0';
    setTimeout(() => {
      if (!state.visible && state.state !== 'EMERGENCY') {
        canvas.innerHTML = '';
      }
    }, 300);
  } else {
    canvas.style.opacity = '1';
  }

  // Auto-advance logic for Queue Item expiration
  if (autoHideTimer) {
    clearTimeout(autoHideTimer);
    autoHideTimer = null;
  }

  if (state.visible && state.activeObjectId) {
    const obj = objectStore.getObject(state.activeObjectId);
    if (obj?.timing?.duration) {
      autoHideTimer = setTimeout(() => {
        eventBus.emit({
          id: `ev_next_${Date.now()}` as any,
          name: 'QUEUE_NEXT' as any,
          timestamp: new Date().toISOString() as any,
          source: 'system' as any,
          sourceType: 'internal' as any,
          payload: {}
        });
      }, obj.timing.duration);
    }
  }
});

// 3. Stinger Wipe Visual Transition
function triggerStinger(phase: 'to_replay' | 'to_live', _peakMs: number): void {
  const wipe = document.getElementById('stinger-wipe');
  if (!wipe) return;

  wipe.className = 'wipe-active';

  // Wipe transition lasts 1.0s, remove active class afterwards to hide it
  setTimeout(() => {
    wipe.className = '';
  }, 1000);
}

// 4. Open BroadcastChannel Event Bridge (Handle unified OverlayBridgeMessage types)
const channel = new BroadcastChannel('quacktrack-events');

channel.onmessage = (message) => {
  console.log('[PROGRAM] bridge message received RAW', message.data);

  const data = message.data;

  if (!data || typeof data !== 'object') {
    console.warn('[PROGRAM] invalid bridge message', data);
    return;
  }

  if (data.type === 'event') {
    // Validate envelope structure before emitting to local event bus
    const validation = validateEventEnvelope(data.event);
    if (validation.success) {
      eventBus.emit(validation.data);
    } else {
      console.warn(
        '[BRIDGE] Discarding invalid event envelope:',
        validation.errors.map((e: any) => `${e.path}: ${e.message}`).join('; ')
      );
    }
  } else if (data.type === 'stinger') {
    triggerStinger(data.phase, data.peakMs);
  } else if (data.type === 'scene') {
    orchestrator.updateSceneContext(data.sceneType);
    console.log(`[BRIDGE] Updated scene context layout to: ${data.sceneType}`);
  }
};

console.log('QUACKTRACK COS Broadcast Output Runtime bootstrapped.');
