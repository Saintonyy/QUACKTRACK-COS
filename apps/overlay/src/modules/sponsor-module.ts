import type { RendererInput } from '@quacktrack/renderer';
import type { SponsorPayload } from '@quacktrack/objects';
import type { BroadcastModule } from './base-module';

export class SponsorModule implements BroadcastModule {
  render(container: HTMLElement, input: RendererInput): void {
    const p = input.resolvedModule.object.payload as SponsorPayload;
    container.className = 'qt-module qt-sponsor-moment';
    container.innerHTML = `
      <div class="qt-sponsor-header">${p.presentationLabel ?? 'SPONSOR MOMENT'}</div>
      <div class="qt-sponsor-name">${p.sponsorName}</div>
    `;
  }

  update(container: HTMLElement, input: RendererInput): void {
    this.render(container, input);
  }
}
