import type { ISODateTime, RuntimeHealth, RuntimeStateSnapshot, RuntimeStatus } from '@quacktrack/core';

const VALID_TRANSITIONS: Record<RuntimeStatus, RuntimeStatus[]> = {
  BOOTING: ['READY', 'LIVE', 'SHUTDOWN'],
  READY: ['LIVE', 'EMERGENCY', 'SHUTDOWN'],
  LIVE: ['DEGRADED', 'RECOVERY', 'EMERGENCY', 'SHUTDOWN'],
  DEGRADED: ['RECOVERY', 'EMERGENCY', 'SHUTDOWN'],
  RECOVERY: ['LIVE', 'DEGRADED', 'SHUTDOWN'],
  EMERGENCY: ['RECOVERY', 'SHUTDOWN'],
  SHUTDOWN: ['BOOTING']
};

const DEFAULT_HEALTH: RuntimeHealth = {
  overall: 'unknown',
  eventBus: 'unknown',
  queueEngine: 'unknown',
  moduleRegistry: 'unknown',
  layoutEngine: 'unknown',
  renderer: 'unknown',
  sponsorPolicy: 'unknown',
  analytics: 'unknown',
  cloudControl: 'unknown',
  obsConnection: 'unknown'
};

export type StateListener = (state: RuntimeStateSnapshot) => void;

export class StateManager {
  private current: RuntimeStateSnapshot;
  private listeners: Set<StateListener> = new Set();

  constructor(initialSnapshot?: Partial<RuntimeStateSnapshot>) {
    const now = new Date().toISOString() as ISODateTime;
    this.current = {
      state: 'BOOTING',
      stateVersion: 1,
      enteredAt: now,
      updatedAt: now,
      health: { ...DEFAULT_HEALTH },
      ...initialSnapshot
    };
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    // Notify immediately with current state as per standard state subscription behaviors
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const snapshot = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (err) {
        console.error('Error in StateManager subscriber:', err);
      }
    }
  }

  getState(): RuntimeStateSnapshot {
    return this.clone(this.current);
  }

  transitionTo(nextState: RuntimeStatus): RuntimeStateSnapshot {
    const currentStatus = this.current.state;
    if (currentStatus !== nextState) {
      const allowed = VALID_TRANSITIONS[currentStatus];
      if (!allowed || !allowed.includes(nextState)) {
        throw new Error(`Invalid state transition from ${currentStatus} to ${nextState}`);
      }

      const now = new Date().toISOString() as ISODateTime;
      this.current.previousState = currentStatus;
      this.current.state = nextState;
      this.current.enteredAt = now;
      this.current.updatedAt = now;
      this.current.stateVersion += 1;
      this.notify();
    }

    return this.clone(this.current);
  }

  updateHealth(healthUpdate: Partial<RuntimeHealth>): RuntimeStateSnapshot {
    this.current.health = {
      ...this.current.health,
      ...healthUpdate
    };
    this.current.updatedAt = new Date().toISOString() as ISODateTime;
    this.current.stateVersion += 1;
    this.notify();

    return this.clone(this.current);
  }

  commit(update: Partial<RuntimeStateSnapshot>): RuntimeStateSnapshot {
    // Prevent overriding read-only/managed fields directly without incrementing logic,
    // though we can still merge them and increment version.
    const { state, previousState, enteredAt, health, ...rest } = update;

    // We can merge health if it is provided
    if (health) {
      this.current.health = {
        ...this.current.health,
        ...health
      };
    }

    // Merge other fields
    Object.assign(this.current, rest);

    this.current.updatedAt = new Date().toISOString() as ISODateTime;
    this.current.stateVersion += 1;
    this.notify();

    return this.clone(this.current);
  }

  private clone<T>(obj: T): T {
    if (typeof structuredClone === 'function') {
      return structuredClone(obj);
    }
    return JSON.parse(JSON.stringify(obj)) as T;
  }
}

export type RuntimeStateStore = StateManager;
