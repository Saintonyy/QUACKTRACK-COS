import { describe, expect, it } from 'vitest';
import { StateManager } from '../state-manager';

describe('StateManager', () => {
  it('should initialize state correctly', () => {
    const manager = new StateManager();
    const snapshot = manager.getState();

    expect(snapshot.state).toBe('BOOTING');
    expect(snapshot.stateVersion).toBe(1);
    expect(snapshot.health.overall).toBe('unknown');
  });

  it('should increment stateVersion on status transitions', () => {
    const manager = new StateManager();
    const first = manager.transitionTo('READY');
    expect(first.state).toBe('READY');
    expect(first.stateVersion).toBe(2);

    const second = manager.transitionTo('LIVE');
    expect(second.state).toBe('LIVE');
    expect(second.stateVersion).toBe(3);
    expect(second.previousState).toBe('READY');
  });

  it('should throw error on invalid transitions', () => {
    const manager = new StateManager();
    // BOOTING to EMERGENCY is invalid
    expect(() => manager.transitionTo('EMERGENCY')).toThrow();
  });

  it('should increment version and merge values on health updates', () => {
    const manager = new StateManager();
    const snapshot = manager.updateHealth({ overall: 'healthy', eventBus: 'healthy' });

    expect(snapshot.stateVersion).toBe(2);
    expect(snapshot.health.overall).toBe('healthy');
    expect(snapshot.health.eventBus).toBe('healthy');
    expect(snapshot.health.renderer).toBe('unknown'); // unchanged
  });

  it('should increment version on general commits', () => {
    const manager = new StateManager();
    manager.transitionTo('READY'); // version 2

    const snapshot = manager.commit({
      visible: true,
      queueLength: 5,
      activeModuleId: 'player.standard' as any
    });

    expect(snapshot.stateVersion).toBe(3);
    expect(snapshot.visible).toBe(true);
    expect(snapshot.queueLength).toBe(5);
    expect(snapshot.activeModuleId).toBe('player.standard');
  });

  it('should return immutable snapshots', () => {
    const manager = new StateManager();
    const snapshot = manager.getState();

    // Mutate snapshot
    (snapshot as any).state = 'SHUTDOWN';
    (snapshot.health as any).overall = 'fatal';

    // Verify stored state is unaffected
    const current = manager.getState();
    expect(current.state).toBe('BOOTING');
    expect(current.health.overall).toBe('unknown');
  });

  it('should notify subscribers on transitions, health updates, and commits', () => {
    const manager = new StateManager();
    const states: any[] = [];
    const unsubscribe = manager.subscribe((state) => {
      states.push(state);
    });

    // Initial subscription fires immediately
    expect(states).toHaveLength(1);
    expect(states[0].state).toBe('BOOTING');

    // Transition
    manager.transitionTo('READY');
    expect(states).toHaveLength(2);
    expect(states[1].state).toBe('READY');

    // Health update
    manager.updateHealth({ overall: 'healthy' });
    expect(states).toHaveLength(3);
    expect(states[2].health.overall).toBe('healthy');

    // Commit
    manager.commit({ visible: true });
    expect(states).toHaveLength(4);
    expect(states[3].visible).toBe(true);

    // Unsubscribe
    unsubscribe();
    manager.transitionTo('LIVE');
    expect(states).toHaveLength(4); // did not receive new state
  });
});
