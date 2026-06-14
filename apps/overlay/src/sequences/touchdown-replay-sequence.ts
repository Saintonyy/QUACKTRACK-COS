import type { EventBus, RuntimeOrchestrator } from '@quacktrack/runtime';

export const TOUCHDOWN_REPLAY_SEQUENCE_TIMING = {
  stingerDurationMs: 1000,
  stingerPeakMs: 500,
  replayDelayMs: 600,
  playerDelayMs: 2500,
  sponsorDelayMs: 6000,
  returnWipeDelayMs: 9500,
  returnPeakMs: 10000
};

export interface TouchdownReplayParams {
  eventBus: EventBus;
  channel: BroadcastChannel;
  orchestrator: RuntimeOrchestrator;
  triggerStinger: (phase: 'to_replay' | 'to_live', peakMs: number) => void;
}

export function runTouchdownReplaySequence(params: TouchdownReplayParams): void {
  const { eventBus, channel, orchestrator, triggerStinger } = params;

  // Helper to publish event locally (main.ts eventBus subscription will bridge it to avoiding double-posting)
  function emitAndBridge(envelope: any) {
    eventBus.emit(envelope);
  }

  function updateSceneAndBridge(sceneType: 'live_game' | 'replay') {
    orchestrator.updateSceneContext(sceneType);
    const msg = { type: 'scene', sceneType };
    channel.postMessage(msg);
    console.log('[OPERATOR] bridge message sent', msg);
  }

  function triggerStingerAndBridge(phase: 'to_replay' | 'to_live', peakMs: number) {
    triggerStinger(phase, peakMs);
    const msg = { type: 'stinger', phase, peakMs };
    channel.postMessage(msg);
    console.log('[OPERATOR] bridge message sent', msg);
  }

  // Time 0: Trigger first stinger stinger transition wipe (to replay)
  triggerStingerAndBridge('to_replay', TOUCHDOWN_REPLAY_SEQUENCE_TIMING.stingerPeakMs);

  // Time 500ms: Stinger peak! Transition scene to replay
  setTimeout(() => {
    updateSceneAndBridge('replay');
  }, TOUCHDOWN_REPLAY_SEQUENCE_TIMING.stingerPeakMs);

  // Time 600ms: Trigger Replay Context graphic
  setTimeout(() => {
    emitAndBridge({
      id: `ev_rep_${Date.now()}` as any,
      name: 'REPLAY_CONTEXT' as any,
      timestamp: new Date().toISOString() as any,
      source: 'operator_panel' as any,
      sourceType: 'human' as any,
      payload: {
        replayId: 'rep_001',
        replayLabel: 'TOUCHDOWN PLAY',
        momentDescription: 'Donald Miller - 45YD Touchdown run',
        angleLabel: 'SKYCAM 1'
      },
      options: {
        duration: 8000 as any, // active during the replay
        autoHide: true
      }
    });
  }, TOUCHDOWN_REPLAY_SEQUENCE_TIMING.replayDelayMs);

  // Time 2500ms: Trigger Player introduction graphic
  setTimeout(() => {
    emitAndBridge({
      id: `ev_play_rep_${Date.now()}` as any,
      name: 'PLAYER_INTRODUCTION' as any,
      timestamp: new Date().toISOString() as any,
      source: 'operator_panel' as any,
      sourceType: 'human' as any,
      payload: {
        playerName: "Donald 'Quack' Miller",
        number: "07",
        position: "Point Guard",
        team: "QUACK CITY DUCKS"
      },
      options: {
        duration: 6000 as any,
        autoHide: true
      }
    });
  }, TOUCHDOWN_REPLAY_SEQUENCE_TIMING.playerDelayMs);

  // Time 6000ms: Trigger Sponsor attachment
  setTimeout(() => {
    emitAndBridge({
      id: `ev_spon_rep_${Date.now()}` as any,
      name: 'SPONSOR_MOMENT' as any,
      timestamp: new Date().toISOString() as any,
      source: 'operator_panel' as any,
      sourceType: 'human' as any,
      payload: {
        sponsorName: "AFLAC INSURANCE",
        sponsorSlot: "lower-third",
        presentationLabel: "OFFICIAL REPLAY SPONSOR"
      },
      options: {
        duration: 3000 as any,
        autoHide: true
      }
    });
  }, TOUCHDOWN_REPLAY_SEQUENCE_TIMING.sponsorDelayMs);

  // Time 9500ms: Trigger return stinger transition wipe (to live)
  setTimeout(() => {
    triggerStingerAndBridge('to_live', TOUCHDOWN_REPLAY_SEQUENCE_TIMING.stingerPeakMs);
  }, TOUCHDOWN_REPLAY_SEQUENCE_TIMING.returnWipeDelayMs);

  // Time 10000ms: Peak of return stinger! Transition scene back to live_game and COS_HIDE
  setTimeout(() => {
    updateSceneAndBridge('live_game');
    emitAndBridge({
      id: `ev_hide_rep_${Date.now()}` as any,
      name: 'COS_HIDE' as any,
      timestamp: new Date().toISOString() as any,
      source: 'operator_panel' as any,
      sourceType: 'human' as any,
      payload: {}
    });
  }, TOUCHDOWN_REPLAY_SEQUENCE_TIMING.returnPeakMs);
}
