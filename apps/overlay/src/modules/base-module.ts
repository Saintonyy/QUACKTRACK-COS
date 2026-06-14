import type { RendererInput } from '@quacktrack/renderer';

export interface BroadcastModule {
  render(container: HTMLElement, input: RendererInput): void;
  update?(container: HTMLElement, input: RendererInput): void;
  destroy?(container: HTMLElement): void;
}
