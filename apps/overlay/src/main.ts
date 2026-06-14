import { createOverlayRuntime } from './create-runtime';
import { runTouchdownReplaySequence } from './sequences/touchdown-replay-sequence';
import { transitionScene } from './sequences/scene-transition';

// 1. Boot common runtime services using the shared helper
const { eventBus, stateManager, objectStore, healthMonitor, orchestrator } = createOverlayRuntime('program-canvas');

// Initialize State
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

// 2. Responsive Auto-scaling for the 1920x1080 Broadcast Canvas (Developer Simulator Viewport)
function resizeCanvas(): void {
  const canvas = document.getElementById('program-canvas');
  const wrapper = document.getElementById('program-canvas-wrapper');
  const scaleIndicator = document.getElementById('scale-indicator');
  if (!canvas || !wrapper || !scaleIndicator) return;

  const wrapperWidth = wrapper.clientWidth;
  const wrapperHeight = wrapper.clientHeight;

  // Leaves margin around the canvas inside the panel viewport
  const availWidth = Math.max(wrapperWidth - 40, 200);
  const availHeight = Math.max(wrapperHeight - 60, 150);

  const scaleX = availWidth / 1920;
  const scaleY = availHeight / 1080;
  const scale = Math.min(scaleX, scaleY);

  canvas.style.transform = `scale(${scale})`;
  scaleIndicator.textContent = `SCALE: ${Math.round(scale * 100)}%`;

  // Center canvas inside the wrapper viewport
  const left = (wrapperWidth - 1920 * scale) / 2;
  const top = 40 + (wrapperHeight - 40 - 1080 * scale) / 2;
  canvas.style.left = `${left}px`;
  canvas.style.top = `${top}px`;
}

window.addEventListener('resize', resizeCanvas);
// Run scale calculation immediately
setTimeout(resizeCanvas, 0);

// 3. Wire Operational Log Panel
const logPanel = document.getElementById('deck-log');
function addLog(text: string, type: 'system' | 'event' | 'error' = 'system') {
  if (!logPanel) return;
  const line = document.createElement('div');
  line.className = `log-line ${type}`;
  const time = new Date().toLocaleTimeString();
  line.textContent = `[${time}] ${text}`;
  logPanel.appendChild(line);
  logPanel.scrollTop = logPanel.scrollHeight;
}

// 4. Open the BroadcastChannel Event Bridge
const channel = new BroadcastChannel('quacktrack-events');

// Subscribe to EventBus to log all published events and bridge to clean screen
eventBus.subscribe((envelope) => {
  // Bridge events to other contexts (like program.html)
  // Graphics triggers are posted explicitly by their button listeners, so we skip them here to avoid double-posting.
  const isGraphicsTrigger = [
    'PLAYER_INTRODUCTION',
    'PLAYER_STAT',
    'SPONSOR_MOMENT',
    'BREAKING_UPDATE'
  ].includes(envelope.name) && envelope.source === 'operator_panel';

  if (!isGraphicsTrigger) {
    try {
      const msg = { type: 'event', event: envelope };
      channel.postMessage(msg);
      console.log('[OPERATOR] bridge message sent', msg);
    } catch (err) {
      console.error('Failed to post event message to channel bridge:', err);
    }
  }

  // Operational logger formatting (human-readable layout instead of technical schemas)
  const isQueue = envelope.options?.queueBehavior === 'queue';
  const action = isQueue ? 'queued' : 'sent';

  let opMessage = '';
  if (envelope.name === 'PLAYER_INTRODUCTION') {
    const p = envelope.payload as any;
    opMessage = `${envelope.name} sent`;
    // Format: PLAYER_INTRODUCTION sent
  } else if (envelope.name === 'PLAYER_STAT') {
    opMessage = `${envelope.name} sent`;
  } else if (envelope.name === 'SPONSOR_MOMENT') {
    opMessage = `${envelope.name} ${action}`;
  } else if (envelope.name === 'BREAKING_UPDATE') {
    opMessage = `${envelope.name} sent`;
  } else if (envelope.name === 'COS_HIDE') {
    opMessage = `COS_HIDE cleared`;
  } else if (envelope.name === 'EMERGENCY_CLEAR') {
    opMessage = `EMERGENCY_CLEAR cleared`;
  } else if (envelope.name === 'QUEUE_NEXT') {
    opMessage = `QUEUE_NEXT triggered`;
  } else {
    // Other events are either system-level or skipped to maintain cleaner operational feed
    return;
  }

  addLog(opMessage, 'event');
});

// 5. Local Stinger Visual Wipe Animation Trigger
function triggerStinger(phase: 'to_replay' | 'to_live', _peakMs: number): void {
  const wipe = document.getElementById('stinger-wipe');
  if (!wipe) return;

  wipe.className = 'wipe-active';

  // Wipe lasts 1.0s, remove active class afterwards to hide it
  setTimeout(() => {
    wipe.className = '';
  }, 1000);
}

// 6. StateManager Subscriptions (Updates controls, dashboard, and handles clear states)
let autoHideTimer: any = null;
let lastSceneType: string | null = null;

stateManager.subscribe((state) => {
  // Canvas display clear states
  const canvas = document.getElementById('program-canvas');
  if (canvas) {
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
  }

  // 1. Active Graphic
  const statusActiveGraphic = document.getElementById('status-active-graphic');
  if (statusActiveGraphic) {
    const activeItem = orchestrator.getActiveItem();
    statusActiveGraphic.textContent = activeItem ? activeItem.eventName : 'None';
  }

  // 2. Next Item
  const statusNextItem = document.getElementById('status-next-item');
  if (statusNextItem) {
    const nextItem = orchestrator.getQueue().find(i => i.status === 'pending');
    statusNextItem.textContent = nextItem ? nextItem.eventName : 'None';
  }

  // 3. Queue Length
  const statusQueueLength = document.getElementById('status-queue-length');
  if (statusQueueLength) {
    statusQueueLength.textContent = String(state.queueLength ?? 0);
  }

  // 4. Scene Type Check & Dynamic Active Log
  const statusActiveScene = document.getElementById('status-active-scene');
  const sceneType = state.activeSceneId === 'scene_replay' ? 'replay' : 'live_game';
  if (statusActiveScene) {
    statusActiveScene.textContent = sceneType;
  }

  if (sceneType !== lastSceneType) {
    const sceneLabel = sceneType === 'replay' ? 'REPLAY' : 'LIVE';
    if (lastSceneType !== null) {
      addLog(`${sceneLabel} scene active`, 'system');
    }
    lastSceneType = sceneType;
  }

  // 5. Health Status Panel
  const statusHealth = document.getElementById('status-health');
  if (statusHealth) {
    const overall = state.health.overall;
    statusHealth.textContent = overall;
    statusHealth.className = `health-val ${overall}`;
  }

  // Header status indicator dot
  const systemStatusDot = document.getElementById('system-status-dot');
  const systemStatusText = document.getElementById('system-status-text');
  if (systemStatusDot && systemStatusText) {
    systemStatusText.textContent = state.state;
    systemStatusDot.className = `status-dot ${state.state.toLowerCase()}`;
  }

  // 6. Dynamic Queue List Rendering
  const queueListItems = document.getElementById('queue-list-items');
  if (queueListItems) {
    const pendingItems = orchestrator.getQueue().filter(i => i.status === 'pending');
    if (pendingItems.length === 0) {
      queueListItems.innerHTML = `<div class="queue-placeholder" style="color: var(--color-steel-text); text-align: center; margin-top: 20px;">Queue is empty.</div>`;
    } else {
      queueListItems.innerHTML = pendingItems.map(item => {
        let nameDetail = '';
        if (item.payload) {
          const p = item.payload as any;
          nameDetail = p.playerName || p.subjectName || p.headline || p.sponsorName || 'Graphic';
        }
        return `
          <div class="queue-item-row">
            <span class="queue-item-type">${item.eventName}</span>
            <span class="queue-item-name">${nameDetail}</span>
            <span class="queue-item-priority ${item.priority}">${item.priority}</span>
          </div>
        `;
      }).join('');
    }
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

// Helper: Ensure system transitions out of EMERGENCY when manual events trigger
function ensureLive(): void {
  const current = stateManager.getState().state;
  if (current === 'EMERGENCY') {
    stateManager.transitionTo('RECOVERY');
    stateManager.transitionTo('LIVE');
    addLog('SYSTEM TRANSITIONED: EMERGENCY -> RECOVERY -> LIVE', 'system');
  }
}

// 7. Wire Tab Switcher DOM Logic
const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanes = document.querySelectorAll('.tab-pane');
tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.getAttribute('data-tab');
    if (!target) return;
    tabButtons.forEach(b => b.classList.remove('active'));
    tabPanes.forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const pane = document.getElementById(target);
    if (pane) pane.classList.add('active');
  });
});

// 8. Wire Up Form Action Triggers (Show Now & Queue)
function triggerPlayerIntro(queueBehavior: 'showNow' | 'queue') {
  ensureLive();
  const name = (document.getElementById('input-player-name') as HTMLInputElement).value;
  const num = (document.getElementById('input-player-number') as HTMLInputElement).value;
  const pos = (document.getElementById('input-player-position') as HTMLInputElement).value;

  const event = {
    id: `ev_player_${Date.now()}` as any,
    name: 'PLAYER_INTRODUCTION' as any,
    timestamp: new Date().toISOString() as any,
    source: 'operator_panel' as any,
    sourceType: 'human' as any,
    payload: {
      playerName: name,
      number: num,
      position: pos,
      team: 'QUACK CITY DUCKS'
    },
    options: {
      queueBehavior
    }
  };

  eventBus.emit(event);
  channel.postMessage({ type: 'event', event });
  console.log(`[OPERATOR] graphics event sent ${event.name} ${queueBehavior}`);
}
document.getElementById('btn-player-show-now')?.addEventListener('click', () => triggerPlayerIntro('showNow'));
document.getElementById('btn-player-queue')?.addEventListener('click', () => triggerPlayerIntro('queue'));

function triggerPlayerStat(queueBehavior: 'showNow' | 'queue') {
  ensureLive();
  const name = (document.getElementById('input-stat-name') as HTMLInputElement).value;
  const label = (document.getElementById('input-stat-label') as HTMLInputElement).value;
  const val = (document.getElementById('input-stat-value') as HTMLInputElement).value;

  const event = {
    id: `ev_stat_${Date.now()}` as any,
    name: 'PLAYER_STAT' as any,
    timestamp: new Date().toISOString() as any,
    source: 'operator_panel' as any,
    sourceType: 'human' as any,
    payload: {
      subjectName: name,
      statCategory: 'SEASON STATISTICS',
      primaryMetric: {
        value: val,
        label: label
      }
    },
    options: {
      queueBehavior
    }
  };

  eventBus.emit(event);
  channel.postMessage({ type: 'event', event });
  console.log(`[OPERATOR] graphics event sent ${event.name} ${queueBehavior}`);
}
document.getElementById('btn-stat-show-now')?.addEventListener('click', () => triggerPlayerStat('showNow'));
document.getElementById('btn-stat-queue')?.addEventListener('click', () => triggerPlayerStat('queue'));

function triggerSponsorMoment(queueBehavior: 'showNow' | 'queue') {
  ensureLive();
  const sponsor = (document.getElementById('input-sponsor-name') as HTMLInputElement).value;

  const event = {
    id: `ev_sponsor_${Date.now()}` as any,
    name: 'SPONSOR_MOMENT' as any,
    timestamp: new Date().toISOString() as any,
    source: 'operator_panel' as any,
    sourceType: 'human' as any,
    payload: {
      sponsorName: sponsor,
      sponsorSlot: 'lower-third',
      presentationLabel: 'OFFICIAL SPONSOR'
    },
    options: {
      queueBehavior
    }
  };

  eventBus.emit(event);
  channel.postMessage({ type: 'event', event });
  console.log(`[OPERATOR] graphics event sent ${event.name} ${queueBehavior}`);
}
document.getElementById('btn-sponsor-show-now')?.addEventListener('click', () => triggerSponsorMoment('showNow'));
document.getElementById('btn-sponsor-queue')?.addEventListener('click', () => triggerSponsorMoment('queue'));

function triggerBreakingUpdate(queueBehavior: 'showNow' | 'queue') {
  ensureLive();
  const text = (document.getElementById('input-breaking-text') as HTMLInputElement).value;

  const event = {
    id: `ev_breaking_${Date.now()}` as any,
    name: 'BREAKING_UPDATE' as any,
    timestamp: new Date().toISOString() as any,
    source: 'operator_panel' as any,
    sourceType: 'human' as any,
    payload: {
      headline: text
    },
    options: {
      queueBehavior
    }
  };

  eventBus.emit(event);
  channel.postMessage({ type: 'event', event });
  console.log(`[OPERATOR] graphics event sent ${event.name} ${queueBehavior}`);
}
document.getElementById('btn-breaking-show-now')?.addEventListener('click', () => triggerBreakingUpdate('showNow'));
document.getElementById('btn-breaking-queue')?.addEventListener('click', () => triggerBreakingUpdate('queue'));

// 9. Scene Switches & Sequencer Wiring
document.getElementById('btn-scene-live')?.addEventListener('click', () => {
  ensureLive();
  transitionScene({
    sceneType: 'live_game',
    orchestrator,
    channel,
    triggerStinger
  });
});

document.getElementById('btn-scene-replay')?.addEventListener('click', () => {
  ensureLive();
  transitionScene({
    sceneType: 'replay',
    orchestrator,
    channel,
    triggerStinger
  });
});

document.getElementById('btn-scene-touchdown-seq')?.addEventListener('click', () => {
  ensureLive();
  runTouchdownReplaySequence({
    eventBus,
    channel,
    orchestrator,
    triggerStinger
  });
});

// 10. Queue Control Deck Commands
document.getElementById('btn-queue-next')?.addEventListener('click', () => {
  eventBus.emit({
    id: `ev_next_${Date.now()}` as any,
    name: 'QUEUE_NEXT' as any,
    timestamp: new Date().toISOString() as any,
    source: 'operator_panel' as any,
    sourceType: 'human' as any,
    payload: {}
  });
});

document.getElementById('btn-operator-hide')?.addEventListener('click', () => {
  eventBus.emit({
    id: `ev_hide_${Date.now()}` as any,
    name: 'COS_HIDE' as any,
    timestamp: new Date().toISOString() as any,
    source: 'operator_panel' as any,
    sourceType: 'human' as any,
    payload: {}
  });
});

document.getElementById('btn-operator-clear')?.addEventListener('click', () => {
  eventBus.emit({
    id: `ev_clear_${Date.now()}` as any,
    name: 'EMERGENCY_CLEAR' as any,
    timestamp: new Date().toISOString() as any,
    source: 'operator_panel' as any,
    sourceType: 'human' as any,
    payload: {}
  });
});

// Initial Bootstrap complete
addLog('System successfully bootstrapped in LIVE state.', 'system');
console.log('QUACKTRACK COS Operator Control Console active.', orchestrator);
