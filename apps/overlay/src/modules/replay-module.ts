import type { RendererInput } from '@quacktrack/renderer';
import type { ReplayPayload } from '@quacktrack/objects';
import type { BroadcastModule } from './base-module';

export class ReplayModule implements BroadcastModule {
  render(container: HTMLElement, input: RendererInput): void {
    const p = input.resolvedModule.object.payload as ReplayPayload;
    container.className = 'qt-module qt-replay-card';
    container.innerHTML = `
      <div class="qt-replay-header">
        REPLAY
      </div>
      <div class="qt-replay-desc">${p.momentDescription}</div>
      <div class="qt-replay-angle">${p.angleLabel ?? 'SKYCAM 1'}</div>
    `;
  }

  update(container: HTMLElement, input: RendererInput): void {
    this.render(container, input);
  }
}
