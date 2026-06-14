import type { ISODateTime, RuntimeError } from '@quacktrack/core';
import type { BroadcastObject } from '@quacktrack/objects';
import type { ResolvedPlacement } from '@quacktrack/layout';
import type { ResolvedModuleDefinition } from '@quacktrack/registry';

export interface RendererInput<TObject extends BroadcastObject = BroadcastObject> {
  resolvedModule: ResolvedModuleDefinition<TObject>;
  placement: ResolvedPlacement;
}

export interface RendererError extends RuntimeError {
  code: string;
  message: string;
  recoverable: boolean;
}

export type RendererResult =
  | {
      success: true;
      moduleId: ResolvedModuleDefinition['moduleId'];
      placementId: ResolvedPlacement['placementId'];
      timestamp: ISODateTime;
    }
  | {
      success: false;
      error: RendererError;
    };

export const RENDER_LIFECYCLE_EVENTS = ['render.started', 'render.completed', 'render.failed'] as const;

export type RenderLifecycleEventType = (typeof RENDER_LIFECYCLE_EVENTS)[number];

export interface RenderLifecycleEvent {
  type: RenderLifecycleEventType;
  moduleId: ResolvedModuleDefinition['moduleId'];
  placementId?: ResolvedPlacement['placementId'];
  timestamp: ISODateTime;
  error?: RendererError;
}

export interface RendererAdapter {
  render(input: RendererInput): RendererResult;
  onLifecycleEvent?(event: RenderLifecycleEvent): void;
}
