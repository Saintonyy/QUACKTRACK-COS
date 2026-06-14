import type { RuntimeError } from '@quacktrack/core';
import type { RuntimeHealthSnapshot } from './types';

export class RuntimeHealthMonitor {
  private eventsProcessed = 0;
  private eventsRejected = 0;
  private rendererFailures = 0;
  private queueDepth = 0;
  private stateTransitions = 0;
  private lastError: RuntimeError | null = null;

  recordEventProcessed(): void {
    this.eventsProcessed += 1;
  }

  recordEventRejected(): void {
    this.eventsRejected += 1;
  }

  recordRendererFailure(): void {
    this.rendererFailures += 1;
  }

  recordQueueDepth(depth: number): void {
    this.queueDepth = depth;
  }

  recordStateTransition(): void {
    this.stateTransitions += 1;
  }

  recordError(error: RuntimeError): void {
    this.lastError = error;
  }

  getSnapshot(): RuntimeHealthSnapshot {
    return {
      eventsProcessed: this.eventsProcessed,
      eventsRejected: this.eventsRejected,
      rendererFailures: this.rendererFailures,
      queueDepth: this.queueDepth,
      stateTransitions: this.stateTransitions,
      lastError: this.lastError ? { ...this.lastError } : null
    };
  }
}
