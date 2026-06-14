import type { RuntimeError } from '@quacktrack/core';
import type { EventEnvelope, EventValidationError } from '@quacktrack/events';
import type { BroadcastObject } from '@quacktrack/objects';
import type { ResolvedPlacement } from '@quacktrack/layout';
import type { ResolvedModuleDefinition } from '@quacktrack/registry';
import type { QueueItem } from '@quacktrack/queue';
import type { RendererResult } from '@quacktrack/renderer';
import type { AnalyticsRecord } from '@quacktrack/analytics';

export type EventHandler = (event: EventEnvelope) => void;

export type EventMiddleware = (
  event: EventEnvelope,
  next: (event: EventEnvelope) => EventDispatchResult
) => EventDispatchResult;

export interface EventDispatchResult {
  accepted: boolean;
  rejected: boolean;
  eventId: string;
  handlerErrors?: Error[];
  validationErrors?: EventValidationError[];
}

export interface RuntimeExecutionResult {
  accepted: boolean;
  event: EventEnvelope;
  object?: BroadcastObject;
  queueItem?: QueueItem;
  resolvedModule?: ResolvedModuleDefinition;
  resolvedPlacement?: ResolvedPlacement;
  rendererResult?: RendererResult;
  analyticsRecords: AnalyticsRecord[];
  errors?: RuntimeError[];
}

export interface RuntimeHealthSnapshot {
  eventsProcessed: number;
  eventsRejected: number;
  rendererFailures: number;
  queueDepth: number;
  stateTransitions: number;
  lastError?: RuntimeError | null;
}
