import { validateEventEnvelope, type EventEnvelope, type EventValidationError } from '@quacktrack/events';
import type { EventDispatchResult, EventHandler, EventMiddleware } from './types';

export class EventBus {
  private globalHandlers = new Set<EventHandler>();
  private namedHandlers = new Map<string, Set<EventHandler>>();
  private middleware: EventMiddleware[] = [];
  private eventHistory: EventEnvelope[] = [];

  use(mw: EventMiddleware): void {
    this.middleware.push(mw);
  }

  subscribe(handler: EventHandler): void;
  subscribe(eventName: string, handler: EventHandler): void;
  subscribe(arg1: string | EventHandler, arg2?: EventHandler): void {
    if (typeof arg1 === 'string') {
      const eventName = arg1;
      const handler = arg2;
      if (!handler) return;
      let handlers = this.namedHandlers.get(eventName);
      if (!handlers) {
        handlers = new Set<EventHandler>();
        this.namedHandlers.set(eventName, handlers);
      }
      handlers.add(handler);
    } else {
      const handler = arg1;
      this.globalHandlers.add(handler);
    }
  }

  unsubscribe(handler: EventHandler): void;
  unsubscribe(eventName: string, handler: EventHandler): void;
  unsubscribe(arg1: string | EventHandler, arg2?: EventHandler): void {
    if (typeof arg1 === 'string') {
      const eventName = arg1;
      const handler = arg2;
      if (!handler) return;
      const handlers = this.namedHandlers.get(eventName);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.namedHandlers.delete(eventName);
        }
      }
    } else {
      const handler = arg1;
      this.globalHandlers.delete(handler);
    }
  }

  emit(event: EventEnvelope): EventDispatchResult {
    const validation = validateEventEnvelope(event);
    if (!validation.success) {
      return {
        accepted: false,
        rejected: true,
        eventId: event.id,
        validationErrors: validation.errors as unknown as EventValidationError[]
      };
    }

    let middlewareIndex = 0;

    const dispatchToHandlers = (evt: EventEnvelope): EventDispatchResult => {
      this.eventHistory.push(evt);
      const handlerErrors: Error[] = [];

      // Global handlers
      for (const handler of this.globalHandlers) {
        try {
          handler(evt);
        } catch (err) {
          handlerErrors.push(err instanceof Error ? err : new Error(String(err)));
        }
      }

      // Named handlers
      const handlers = this.namedHandlers.get(evt.name);
      if (handlers) {
        for (const handler of handlers) {
          try {
            handler(evt);
          } catch (err) {
            handlerErrors.push(err instanceof Error ? err : new Error(String(err)));
          }
        }
      }

      const result: EventDispatchResult = {
        accepted: true,
        rejected: false,
        eventId: evt.id
      };
      if (handlerErrors.length > 0) {
        result.handlerErrors = handlerErrors;
      }
      return result;
    };

    const next = (currentEvent: EventEnvelope): EventDispatchResult => {
      const mw = this.middleware[middlewareIndex++];
      if (mw !== undefined) {
        return mw(currentEvent, next);
      }
      return dispatchToHandlers(currentEvent);
    };

    return next(event);
  }

  replay(handlers: EventHandler[]): void {
    for (const event of this.eventHistory) {
      for (const handler of handlers) {
        try {
          // If we subscribe by event name internally, replay executes it on all passed handlers.
          // Let's call the handler.
          handler(event);
        } catch (err) {
          // Keep replay robust
        }
      }
    }
  }

  getHistory(): EventEnvelope[] {
    return [...this.eventHistory];
  }

  clearHistory(): void {
    this.eventHistory = [];
  }
}
