import { describe, expect, it } from 'vitest';

import {
  canInterrupt,
  createQueueItem,
  expireQueueItems,
  orderQueueItems,
  queueItemSchema,
  queueStatusSchema,
  selectNextQueueItem,
  validateQueueItem
} from '..';
import type { DurationMs, ISODateTime, ModuleId, QueueItemId, SponsorId } from '@quacktrack/core';
import type { BroadcastObject, SponsorAttachment } from '@quacktrack/objects';
import type { QueueItem, QueueStatus } from '..';

const now = '2026-06-13T23:00:00.000Z' as ISODateTime;

const object = {
  id: 'obj_player',
  objectVersion: 1,
  schemaVersion: '1.0',
  type: 'player',
  family: 'Person Context',
  lifecycle: 'VALIDATED',
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
    eventId: 'evt_player',
    eventName: 'PLAYER_INTRODUCTION',
    source: 'operator_panel',
    sourceType: 'human',
    timestamp: now
  },
  createdAt: now
} as unknown as BroadcastObject;

const sponsorAttachment = {
  sponsorId: 'sp_001',
  sponsorName: 'Acme Sports',
  sponsorSlot: 'lower-third',
  displayMode: 'logo',
  policy: 'required',
  fulfillmentStatus: 'pending'
} as unknown as SponsorAttachment;

function createItem(overrides: Partial<QueueItem> = {}): QueueItem {
  return {
    id: 'queue_001',
    objectId: 'obj_player',
    eventName: 'PLAYER_INTRODUCTION',
    objectType: 'player',
    moduleId: 'player.standard',
    payload: {
      playerName: 'Alex Rivera',
      team: 'QUACKTRACK'
    },
    priority: 'normal',
    autoHide: true,
    createdAt: now,
    expiration: {},
    triggerSource: 'operator_panel',
    lifecycle: 'VALIDATED',
    status: 'pending',
    supportsInterruption: true,
    ...overrides
  } as unknown as QueueItem;
}

describe('@quacktrack/queue public API', () => {
  it('requires QueueItem core fields', () => {
    expect(validateQueueItem(createItem())).toMatchObject({ success: true });

    const { id: _id, ...withoutId } = createItem() as unknown as Record<string, unknown>;
    const { moduleId: _moduleId, ...withoutModuleId } = createItem() as unknown as Record<string, unknown>;

    expect(queueItemSchema.safeParse(withoutId)).toMatchObject({ success: false });
    expect(queueItemSchema.safeParse(withoutModuleId)).toMatchObject({ success: false });
  });

  it('validates QueueStatus summary fields', () => {
    const status = {
      items: [createItem()],
      activeItemId: 'queue_001',
      length: 1,
      blockedCount: 0,
      expiredCount: 0
    } as unknown as QueueStatus;

    expect(queueStatusSchema.safeParse(status)).toMatchObject({ success: true });
  });

  it('creates queue items from upstream object meaning and module ID', () => {
    const result = createQueueItem({
      id: 'queue_created' as QueueItemId,
      object,
      eventName: 'PLAYER_INTRODUCTION',
      moduleId: 'player.standard' as ModuleId,
      autoHide: true,
      createdAt: now,
      expiration: {
        expiresAfter: 30000 as DurationMs
      },
      triggerSource: 'operator_panel',
      supportsInterruption: true
    });

    expect(result).toMatchObject({
      success: true,
      data: {
        id: 'queue_created',
        objectId: 'obj_player',
        objectType: 'player',
        moduleId: 'player.standard',
        priority: 'normal',
        lifecycle: 'VALIDATED'
      }
    });
  });

  it('sorts critical items before high, normal, and low', () => {
    const ordered = orderQueueItems([
      createItem({ id: 'low' as QueueItemId, priority: 'low' }),
      createItem({ id: 'normal' as QueueItemId, priority: 'normal' }),
      createItem({ id: 'critical' as QueueItemId, priority: 'critical' }),
      createItem({ id: 'high' as QueueItemId, priority: 'high' })
    ]);

    expect(ordered.map((item) => item.id)).toEqual(['critical', 'high', 'normal', 'low']);
  });

  it('sorts same-priority items by accepted creation time', () => {
    const ordered = orderQueueItems([
      createItem({ id: 'late' as QueueItemId, createdAt: '2026-06-13T23:00:10.000Z' as ISODateTime }),
      createItem({ id: 'early' as QueueItemId, createdAt: '2026-06-13T23:00:01.000Z' as ISODateTime })
    ]);

    expect(ordered.map((item) => item.id)).toEqual(['early', 'late']);
  });

  it('removes expired items or marks them expired', () => {
    const expired = createItem({
      id: 'expired' as QueueItemId,
      expiration: {
        expiresAt: '2026-06-13T22:59:59.000Z' as ISODateTime
      }
    });
    const fresh = createItem({ id: 'fresh' as QueueItemId });

    expect(expireQueueItems([expired, fresh], { now }).items?.map((item) => item.id)).toEqual(['fresh']);
    expect(expireQueueItems([expired], { now, markExpired: true })).toMatchObject({
      items: [{ id: 'expired', status: 'expired' }]
    });
  });

  it('marks sponsor items missed or rescheduled when sponsor window expires', () => {
    const sponsorItem = createItem({
      id: 'sponsor' as QueueItemId,
      objectType: 'sponsor',
      payload: {
        sponsorName: 'Acme Sports',
        sponsorSlot: 'lower-third',
        sponsorId: 'sp_001' as SponsorId
      },
      sponsor: sponsorAttachment,
      expiration: {
        sponsorWindowEnd: '2026-06-13T22:59:59.000Z' as ISODateTime
      }
    });

    expect(expireQueueItems([sponsorItem], { now, markExpired: true })).toMatchObject({
      reason: 'expired',
      items: [{ status: 'expired', sponsor: { fulfillmentStatus: 'missed' } }]
    });
    expect(
      expireQueueItems([sponsorItem], {
        now,
        rescheduleSponsorItems: true,
        sponsorRescheduleFor: '2026-06-13T23:05:00.000Z' as ISODateTime
      })
    ).toMatchObject({
      reason: 'sponsor_rescheduled',
      items: [{ status: 'scheduled', scheduledFor: '2026-06-13T23:05:00.000Z' }]
    });
  });

  it('selects next item and skips expired or blocked items', () => {
    const result = selectNextQueueItem(
      [
        createItem({ id: 'blocked' as QueueItemId, priority: 'critical', status: 'blocked' }),
        createItem({
          id: 'expired' as QueueItemId,
          priority: 'high',
          expiration: { expiresAt: '2026-06-13T22:59:59.000Z' as ISODateTime }
        }),
        createItem({ id: 'eligible' as QueueItemId, priority: 'normal', status: 'eligible' })
      ],
      now
    );

    expect(result).toMatchObject({
      accepted: true,
      reason: 'selected_next',
      item: { id: 'eligible' }
    });
  });

  it('allows critical incoming item to interrupt lower priorities when active supports interruption', () => {
    for (const priority of ['low', 'normal', 'high'] as const) {
      expect(canInterrupt(createItem({ priority: 'critical' }), createItem({ priority }))).toBe(true);
    }
  });

  it('prevents lower-priority item from interrupting critical active item', () => {
    expect(canInterrupt(createItem({ priority: 'high' }), createItem({ priority: 'critical' }))).toBe(false);
    expect(
      canInterrupt(createItem({ priority: 'critical' }), createItem({ priority: 'high', supportsInterruption: false }))
    ).toBe(false);
  });
});
