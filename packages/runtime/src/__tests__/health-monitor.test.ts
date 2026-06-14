import { describe, expect, it } from 'vitest';
import { RuntimeHealthMonitor } from '../health-monitor';
import type { ISODateTime } from '@quacktrack/core';

describe('RuntimeHealthMonitor', () => {
  it('should initialize with zeros and null error', () => {
    const monitor = new RuntimeHealthMonitor();
    const snapshot = monitor.getSnapshot();

    expect(snapshot.eventsProcessed).toBe(0);
    expect(snapshot.eventsRejected).toBe(0);
    expect(snapshot.rendererFailures).toBe(0);
    expect(snapshot.queueDepth).toBe(0);
    expect(snapshot.stateTransitions).toBe(0);
    expect(snapshot.lastError).toBeNull();
  });

  it('should track metrics correctly', () => {
    const monitor = new RuntimeHealthMonitor();

    monitor.recordEventProcessed();
    monitor.recordEventProcessed();
    monitor.recordEventRejected();
    monitor.recordRendererFailure();
    monitor.recordQueueDepth(12);
    monitor.recordStateTransition();

    const err = {
      code: 'ERR_TEST',
      message: 'Test error message',
      recoverable: true,
      timestamp: '2026-06-13T23:00:00.000Z' as ISODateTime
    };
    monitor.recordError(err);

    const snapshot = monitor.getSnapshot();
    expect(snapshot.eventsProcessed).toBe(2);
    expect(snapshot.eventsRejected).toBe(1);
    expect(snapshot.rendererFailures).toBe(1);
    expect(snapshot.queueDepth).toBe(12);
    expect(snapshot.stateTransitions).toBe(1);
    expect(snapshot.lastError).toMatchObject(err);
  });
});
