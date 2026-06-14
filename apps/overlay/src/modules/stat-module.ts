import type { RendererInput } from '@quacktrack/renderer';
import type { StatPayload } from '@quacktrack/objects';
import type { BroadcastModule } from './base-module';

export class StatModule implements BroadcastModule {
  render(container: HTMLElement, input: RendererInput): void {
    const p = input.resolvedModule.object.payload as StatPayload;
    container.className = 'qt-module qt-player-stat';
    container.innerHTML = `
      <div class="qt-stat-num-box">
        <div class="qt-stat-value">${p.primaryMetric.value}</div>
        <div class="qt-stat-label">${p.primaryMetric.label}</div>
      </div>
      <div class="qt-stat-player-info">
        <div class="qt-stat-player-name">${p.subjectName ?? 'PLAYER'}</div>
        <div class="qt-stat-player-details">${p.statCategory ?? 'STATISTICS'}</div>
      </div>
    `;
  }

  update(container: HTMLElement, input: RendererInput): void {
    this.render(container, input);
  }
}
