import { describe, expect, it } from 'vitest';

import {
  InMemoryAnalyticsWriter,
  analyticsRecordSchema,
  createAnalyticsRecord,
  layoutAnalyticsPayloadSchema,
  runtimeStateAnalyticsPayloadSchema,
  sponsorAnalyticsPayloadSchema,
  validateAnalyticsRecord
} from '..';
import type {
  AnalyticsRecordId,
  BroadcastObjectId,
  DurationMs,
  EventId,
  ISODateTime,
  QueueItemId,
  SponsorId
} from '@quacktrack/core';
import type { AnalyticsRecord } from '..';

const timestamp = '2026-06-13T23:00:00.000Z' as ISODateTime;

function record(overrides: Partial<AnalyticsRecord> = {}): AnalyticsRecord {
  return {
    id: 'analytics_001' as AnalyticsRecordId,
    analyticsType: 'event.accepted',
    timestamp,
    payload: {
      source: 'operator_panel'
    },
    ...overrides
  };
}

describe('@quacktrack/analytics public API', () => {
  it('requires id, analyticsType, timestamp, and payload', () => {
    expect(validateAnalyticsRecord(record())).toMatchObject({ success: true });

    const { id: _id, ...withoutId } = record() as unknown as Record<string, unknown>;
    const { analyticsType: _analyticsType, ...withoutType } = record() as unknown as Record<string, unknown>;
    const { timestamp: _timestamp, ...withoutTimestamp } = record() as unknown as Record<string, unknown>;
    const { payload: _payload, ...withoutPayload } = record() as unknown as Record<string, unknown>;

    expect(analyticsRecordSchema.safeParse(withoutId)).toMatchObject({ success: false });
    expect(analyticsRecordSchema.safeParse(withoutType)).toMatchObject({ success: false });
    expect(analyticsRecordSchema.safeParse(withoutTimestamp)).toMatchObject({ success: false });
    expect(analyticsRecordSchema.safeParse(withoutPayload)).toMatchObject({ success: false });
  });

  it('allows object-scoped analytics to include objectId', () => {
    expect(
      createAnalyticsRecord({
        id: 'analytics_object' as AnalyticsRecordId,
        analyticsType: 'object.visible',
        timestamp,
        objectId: 'obj_001' as BroadcastObjectId,
        payload: {
          lifecycle: 'VISIBLE'
        }
      })
    ).toMatchObject({
      success: true,
      data: {
        objectId: 'obj_001'
      }
    });
  });

  it('allows event analytics to include eventId', () => {
    expect(
      createAnalyticsRecord({
        id: 'analytics_event' as AnalyticsRecordId,
        analyticsType: 'event.rejected',
        timestamp,
        eventId: 'evt_001' as EventId,
        payload: {
          reason: 'invalid_payload'
        }
      })
    ).toMatchObject({
      success: true,
      data: {
        eventId: 'evt_001'
      }
    });
  });

  it('allows queue analytics to include queueItemId', () => {
    expect(
      createAnalyticsRecord({
        id: 'analytics_queue' as AnalyticsRecordId,
        analyticsType: 'queue.advanced',
        timestamp,
        queueItemId: 'queue_001' as QueueItemId,
        payload: {
          nextPosition: 1
        }
      })
    ).toMatchObject({
      success: true,
      data: {
        queueItemId: 'queue_001'
      }
    });
  });

  it('validates layout analytics requested/resolved zone and scorebug status', () => {
    expect(
      layoutAnalyticsPayloadSchema.parse({
        requestedZone: 'Zone B',
        resolvedZone: 'Zone C',
        requestedDensity: 'expanded',
        resolvedDensity: 'standard',
        collisionDetected: true,
        collisionAction: 'relocate',
        scorebugStatus: 'blocked',
        responsiveFallback: true,
        sceneProfile: 'live_game'
      })
    ).toMatchObject({
      requestedZone: 'Zone B',
      resolvedZone: 'Zone C',
      scorebugStatus: 'blocked'
    });
  });

  it('validates sponsor analytics fulfillment status', () => {
    expect(
      sponsorAnalyticsPayloadSchema.parse({
        sponsorId: 'sp_001' as SponsorId,
        policy: 'required',
        fulfillmentStatus: 'fulfilled',
        requiredDuration: 5000 as DurationMs,
        actualDuration: 5200 as DurationMs
      })
    ).toMatchObject({
      fulfillmentStatus: 'fulfilled'
    });
  });

  it('validates runtime state analytics transition fields', () => {
    expect(
      runtimeStateAnalyticsPayloadSchema.parse({
        previousState: 'READY',
        nextState: 'LIVE',
        transitionReason: 'operator_started_runtime',
        stateVersion: 2,
        healthSnapshot: {
          overall: 'healthy',
          eventBus: 'healthy',
          queueEngine: 'healthy',
          moduleRegistry: 'healthy',
          layoutEngine: 'healthy',
          renderer: 'healthy',
          sponsorPolicy: 'healthy',
          analytics: 'healthy',
          cloudControl: 'unknown',
          obsConnection: 'healthy'
        },
        timestamp
      })
    ).toMatchObject({
      previousState: 'READY',
      nextState: 'LIVE',
      stateVersion: 2
    });
  });

  it('InMemoryAnalyticsWriter appends without mutating existing records', () => {
    const writer = new InMemoryAnalyticsWriter();
    const first = record({
      id: 'analytics_first' as AnalyticsRecordId,
      payload: {
        count: 1
      }
    });
    const second = record({
      id: 'analytics_second' as AnalyticsRecordId,
      payload: {
        count: 2
      }
    });

    expect(writer.append(first)).toMatchObject({ success: true });
    first.payload = { count: 99 };
    expect(writer.append(second)).toMatchObject({ success: true });

    expect(writer.readAll()).toEqual([
      expect.objectContaining({ id: 'analytics_first', payload: { count: 1 } }),
      expect.objectContaining({ id: 'analytics_second', payload: { count: 2 } })
    ]);
  });

  it('writer returns copies instead of internal references', () => {
    const writer = new InMemoryAnalyticsWriter();
    writer.append(record());

    const records = writer.readAll();
    records[0]!.payload = { mutated: true };

    expect(writer.readAll()[0]).toMatchObject({
      payload: {
        source: 'operator_panel'
      }
    });
  });
});
