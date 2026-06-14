import type { RendererInput } from '@quacktrack/renderer';
import type { BreakingPayload } from '@quacktrack/objects';
import type { BroadcastModule } from './base-module';

export class BreakingModule implements BroadcastModule {
  render(container: HTMLElement, input: RendererInput): void {
    const p = input.resolvedModule.object.payload as BreakingPayload;
    container.className = 'qt-module qt-breaking-update';
    container.innerHTML = `
      <div class="qt-breaking-badge">BREAKING</div>
      <div class="qt-breaking-content">${p.headline}</div>
    `;
  }

  update(container: HTMLElement, input: RendererInput): void {
    this.render(container, input);
  }
}
