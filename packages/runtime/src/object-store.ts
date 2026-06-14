import type { BroadcastObjectId } from '@quacktrack/core';
import type { BroadcastObject } from '@quacktrack/objects';

export class ObjectStore {
  private active = new Map<BroadcastObjectId, BroadcastObject>();
  private histories = new Map<BroadcastObjectId, BroadcastObject[]>();

  addObject(object: BroadcastObject): void {
    const existing = this.active.get(object.id);
    if (existing) {
      throw new Error(`Object with ID ${object.id} already exists`);
    }

    const cloned = this.clone(object);
    this.active.set(object.id, cloned);

    let history = this.histories.get(object.id);
    if (!history) {
      history = [];
      this.histories.set(object.id, history);
    }
    history.push(cloned);
  }

  updateObject(object: BroadcastObject): void {
    const current = this.active.get(object.id);
    if (!current) {
      throw new Error(`Object with ID ${object.id} does not exist`);
    }

    if (object.objectVersion <= current.objectVersion) {
      throw new Error(`Stale update: version ${object.objectVersion} is not newer than current version ${current.objectVersion}`);
    }

    const cloned = this.clone(object);
    this.active.set(object.id, cloned);

    const history = this.histories.get(object.id);
    if (history) {
      history.push(cloned);
    }
  }

  removeObject(id: BroadcastObjectId): void {
    const current = this.active.get(id);
    if (!current) {
      throw new Error(`Object with ID ${id} does not exist`);
    }
    this.active.delete(id);
  }

  getObject(id: BroadcastObjectId): BroadcastObject | undefined {
    const obj = this.active.get(id);
    return obj ? this.clone(obj) : undefined;
  }

  getObjects(): BroadcastObject[] {
    return Array.from(this.active.values()).map((obj) => this.clone(obj));
  }

  getHistory(id: BroadcastObjectId): BroadcastObject[] {
    const history = this.histories.get(id);
    return history ? history.map((obj) => this.clone(obj)) : [];
  }

  private clone<T>(obj: T): T {
    if (typeof structuredClone === 'function') {
      return structuredClone(obj);
    }
    return JSON.parse(JSON.stringify(obj)) as T;
  }
}
