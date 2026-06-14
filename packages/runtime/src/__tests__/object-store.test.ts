import { describe, expect, it } from 'vitest';
import { ObjectStore } from '../object-store';
import type { BroadcastObject } from '@quacktrack/objects';
import type { ISODateTime } from '@quacktrack/core';

const now = '2026-06-13T23:00:00.000Z' as ISODateTime;

const createMockObject = (id: string, version: number): BroadcastObject =>
  ({
    id: id as any,
    objectVersion: version,
    schemaVersion: '1.0' as any,
    type: 'player',
    family: 'Person Context',
    lifecycle: 'CREATED',
    priority: 'normal',
    payload: {
      playerName: 'Alex Rivera',
      team: 'QUACKTRACK'
    },
    analytics: {
      impressions: 0,
      displayTime: 0,
      interruptionCount: 0
    },
    source: {
      eventId: 'evt_001' as any,
      eventName: 'PLAYER_INTRODUCTION',
      source: 'operator_panel',
      sourceType: 'human',
      timestamp: now
    },
    createdAt: now
  }) as unknown as BroadcastObject;

describe('ObjectStore', () => {
  it('should add new objects', () => {
    const store = new ObjectStore();
    const obj = createMockObject('obj_1', 1);

    store.addObject(obj);
    expect(store.getObject('obj_1' as any)).toMatchObject({ id: 'obj_1', objectVersion: 1 });
    expect(store.getObjects()).toHaveLength(1);
  });

  it('should reject adding duplicate IDs', () => {
    const store = new ObjectStore();
    const obj1 = createMockObject('obj_1', 1);
    const obj2 = createMockObject('obj_1', 2);

    store.addObject(obj1);
    expect(() => store.addObject(obj2)).toThrow(/already exists/);
  });

  it('should update existing objects with higher version', () => {
    const store = new ObjectStore();
    const obj1 = createMockObject('obj_1', 1);
    store.addObject(obj1);

    const obj2 = createMockObject('obj_1', 2);
    store.updateObject(obj2);

    expect(store.getObject('obj_1' as any)!.objectVersion).toBe(2);
  });

  it('should reject update if ID does not exist', () => {
    const store = new ObjectStore();
    const obj = createMockObject('obj_1', 1);

    expect(() => store.updateObject(obj)).toThrow(/does not exist/);
  });

  it('should reject stale updates', () => {
    const store = new ObjectStore();
    const obj1 = createMockObject('obj_1', 2);
    store.addObject(obj1);

    const obj2 = createMockObject('obj_1', 2);
    const obj3 = createMockObject('obj_1', 1);

    expect(() => store.updateObject(obj2)).toThrow(/Stale update/);
    expect(() => store.updateObject(obj3)).toThrow(/Stale update/);
  });

  it('should remove object but preserve history', () => {
    const store = new ObjectStore();
    const obj1 = createMockObject('obj_1', 1);
    store.addObject(obj1);

    store.removeObject('obj_1' as any);
    expect(store.getObject('obj_1' as any)).toBeUndefined();
    expect(store.getObjects()).toHaveLength(0);

    const history = store.getHistory('obj_1' as any);
    expect(history).toHaveLength(1);
    expect(history[0]!.objectVersion).toBe(1);
  });

  it('should track full history of updates', () => {
    const store = new ObjectStore();
    store.addObject(createMockObject('obj_1', 1));
    store.updateObject(createMockObject('obj_1', 2));
    store.updateObject(createMockObject('obj_1', 3));

    const history = store.getHistory('obj_1' as any);
    expect(history).toHaveLength(3);
    expect(history[0]!.objectVersion).toBe(1);
    expect(history[1]!.objectVersion).toBe(2);
    expect(history[2]!.objectVersion).toBe(3);
  });

  it('should ensure immutability', () => {
    const store = new ObjectStore();
    const obj = createMockObject('obj_1', 1);
    store.addObject(obj);

    const retrieved = store.getObject('obj_1' as any)!;
    retrieved.objectVersion = 100;

    const current = store.getObject('obj_1' as any)!;
    expect(current.objectVersion).toBe(1);
  });
});
