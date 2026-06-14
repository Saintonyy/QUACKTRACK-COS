import type { RendererInput } from '@quacktrack/renderer';
import type { PlayerPayload } from '@quacktrack/objects';
import type { BroadcastModule } from './base-module';

export class PlayerModule implements BroadcastModule {
  render(container: HTMLElement, input: RendererInput): void {
    const p = input.resolvedModule.object.payload as PlayerPayload;
    container.className = 'qt-module qt-player-intro';
    container.innerHTML = `
      <div class="qt-player-number">${p.number ?? '00'}</div>
      <div class="qt-player-details">
        <div class="qt-player-name">${p.playerName}</div>
        <div class="qt-player-pos-team">${p.position ?? 'PLAYER'} • ${p.team}</div>
      </div>
    `;
  }

  update(container: HTMLElement, input: RendererInput): void {
    // If we only need to update the data in place, we can re-render it
    this.render(container, input);
  }
}
