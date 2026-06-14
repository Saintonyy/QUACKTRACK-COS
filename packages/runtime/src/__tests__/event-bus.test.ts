import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../event-bus';
import type { EventEnvelope } from '@quacktrack/events';
import type { ISODateTime } from '@quacktrack/core';

const now = '2026-06-13T23:00:00.000Z' as ISODateTime;

const validEvent: EventEnvelope = {
  id: 'evt_001' as any,
  name: 'PLAYER_INTRODUCTION',
  source: 'operator_panel',
  sourceType: 'human',
  timestamp: now,
  payload: {
    playerName: 'Alex Rivera',
    team: 'QUACKTRACK'
  }
};

const invalidEvent: EventEnvelope = {
  id: '' as any, // invalid EventId
  name: 'INVALID_EVENT_NAME' as any,
  source: 'operator_panel',
  sourceType: 'human',
  timestamp: now,
  payload: {}
};

describe('EventBus', () => {
  it('should register and trigger global and named handlers', () => {
    const bus = new EventBus();
    const globalHandler = vi.fn();
    const namedHandler = vi.fn();

    bus.subscribe(globalHandler);
    bus.subscribe('PLAYER_INTRODUCTION', namedHandler);

    const result = bus.emit(validEvent);
    expect(result.accepted).toBe(true);
    expect(result.rejected).toBe(false);
    expect(globalHandler).toHaveBeenCalledWith(validEvent);
    expect(namedHandler).toHaveBeenCalledWith(validEvent);
  });

  it('should not trigger handler after unsubscribe', () => {
    const bus = new EventBus();
    const globalHandler = vi.fn();

    bus.subscribe(globalHandler);
    bus.unsubscribe(globalHandler);

    bus.emit(validEvent);
    expect(globalHandler).not.toHaveBeenCalled();
  });

  it('should support middleware execution', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    const middleware = vi.fn((event, next) => {
      const modifiedEvent = { ...event, priority: 'critical' as const };
      return next(modifiedEvent);
    });

    bus.use(middleware);
    bus.subscribe(handler);

    bus.emit(validEvent);
    expect(middleware).toHaveBeenCalled();
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ priority: 'critical' }));
  });

  it('should reject invalid events', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.subscribe(handler);

    const result = bus.emit(invalidEvent);
    expect(result.accepted).toBe(false);
    expect(result.rejected).toBe(true);
    expect(result.validationErrors).toBeDefined();
    expect(handler).not.toHaveBeenCalled();
  });

  it('should support event replay for tests', () => {
    const bus = new EventBus();
    const handler1 = vi.fn();
    bus.subscribe(handler1);

    bus.emit(validEvent);

    const replayHandler = vi.fn();
    bus.replay([replayHandler]);

    expect(replayHandler).toHaveBeenCalledWith(validEvent);
  });

  it('should catch handler errors without crashing and report them', () => {
    const bus = new EventBus();
    const crashHandler = () => {
      throw new Error('Handler crashed!');
    };
    bus.subscribe(crashHandler);

    const result = bus.emit(validEvent);
    expect(result.accepted).toBe(true);
    expect(result.handlerErrors).toBeDefined();
    expect(result.handlerErrors![0]!.message).toBe('Handler crashed!');
  });
});
