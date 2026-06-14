import type { RuntimeOrchestrator } from '@quacktrack/runtime';

export interface SceneTransitionParams {
  sceneType: 'live_game' | 'replay';
  orchestrator: RuntimeOrchestrator;
  channel: BroadcastChannel;
  triggerStinger: (phase: 'to_replay' | 'to_live', peakMs: number) => void;
}

export function transitionScene(params: SceneTransitionParams): void {
  const { sceneType, orchestrator, channel, triggerStinger } = params;
  const phase = sceneType === 'replay' ? 'to_replay' : 'to_live';
  const peakMs = 500;

  // 1. Trigger stinger wipe locally
  triggerStinger(phase, peakMs);

  // 2. Broadcast stinger wipe to downstream listeners (e.g. program.html)
  const stingerMsg = { type: 'stinger', phase, peakMs };
  channel.postMessage(stingerMsg);
  console.log('[OPERATOR] bridge message sent', stingerMsg);

  // 3. Update the scene model at peak transition (500ms)
  setTimeout(() => {
    orchestrator.updateSceneContext(sceneType);
    const sceneMsg = { type: 'scene', sceneType };
    channel.postMessage(sceneMsg);
    console.log('[OPERATOR] bridge message sent', sceneMsg);
  }, peakMs);
}
