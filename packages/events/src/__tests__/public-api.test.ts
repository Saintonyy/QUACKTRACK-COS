import { describe, expect, it } from 'vitest';

import {
  eventEnvelopeSchema,
  eventSourceSchema,
  eventSourceTypeSchema,
  isDuplicateEventId,
  isIdempotencyConflict,
  isKnownEventName,
  isNamespacedEventName,
  validateEventEnvelope
} from '..';

const timestamp = '2026-06-13T23:00:00.000Z';

const validEvent = {
  id: 'evt_001',
  name: 'PLAYER_INTRODUCTION',
  source: 'operator_panel',
  sourceType: 'human',
  operatorId: 'op_001',
  timestamp,
  priority: 'normal',
  payload: {
    playerName: 'Alex Rivera',
    team: 'QUACKTRACK'
  },
  options: {
    queueBehavior: 'queue',
    density: 'standard'
  }
};

describe('@quacktrack/events public API', () => {
  it('validates a valid EventEnvelope', () => {
    expect(validateEventEnvelope(validEvent)).toMatchObject({
      success: true,
      data: validEvent
    });
  });

  it('fails when id is missing', () => {
    const { id: _id, ...eventWithoutId } = validEvent;

    expect(eventEnvelopeSchema.safeParse(eventWithoutId)).toMatchObject({
      success: false
    });
  });

  it('fails when name is missing', () => {
    const { name: _name, ...eventWithoutName } = validEvent;

    expect(eventEnvelopeSchema.safeParse(eventWithoutName)).toMatchObject({
      success: false
    });
  });

  it('rejects unknown constant-style events', () => {
    expect(
      eventEnvelopeSchema.safeParse({
        ...validEvent,
        name: 'UNKNOWN_EVENT'
      })
    ).toMatchObject({ success: false });
    expect(isKnownEventName('PLAYER_INTRODUCTION')).toBe(true);
    expect(isKnownEventName('UNKNOWN_EVENT')).toBe(false);
  });

  it('accepts valid namespaced events', () => {
    expect(
      eventEnvelopeSchema.safeParse({
        ...validEvent,
        name: 'runtime.scene_changed'
      })
    ).toMatchObject({ success: true });
    expect(isNamespacedEventName('runtime.scene_changed')).toBe(true);
    expect(isNamespacedEventName('invalid.scene_changed')).toBe(false);
  });

  it('detects duplicate event IDs', () => {
    expect(isDuplicateEventId({ id: 'evt_001' }, { id: 'evt_001' })).toBe(true);
    expect(isDuplicateEventId({ id: 'evt_001' }, [{ id: 'evt_002' }, { id: 'evt_001' }])).toBe(true);
    expect(isDuplicateEventId({ id: 'evt_001' }, { id: 'evt_002' })).toBe(false);
  });

  it('detects idempotency conflicts for same ID with different payloads', () => {
    expect(
      isIdempotencyConflict(
        { id: 'evt_001', payload: { team: 'QUACKTRACK', playerName: 'Alex Rivera' } },
        { id: 'evt_001', payload: { playerName: 'Alex Rivera', team: 'QUACKTRACK' } }
      )
    ).toBe(false);
    expect(
      isIdempotencyConflict(
        { id: 'evt_001', payload: { playerName: 'Alex Rivera' } },
        { id: 'evt_001', payload: { playerName: 'Sam Rivera' } }
      )
    ).toBe(true);
    expect(
      isIdempotencyConflict(
        { id: 'evt_001', payload: { playerName: 'Alex Rivera' } },
        { id: 'evt_002', payload: { playerName: 'Sam Rivera' } }
      )
    ).toBe(false);
  });

  it('requires targetObjectVersion for COS_UPDATE', () => {
    expect(
      eventEnvelopeSchema.safeParse({
        ...validEvent,
        name: 'COS_UPDATE',
        targetObjectId: 'obj_001'
      })
    ).toMatchObject({ success: false });

    expect(
      eventEnvelopeSchema.safeParse({
        ...validEvent,
        name: 'COS_UPDATE',
        targetObjectId: 'obj_001',
        targetObjectVersion: 2
      })
    ).toMatchObject({ success: true });
  });

  it('allows WEATHER_ALERT to carry critical priority', () => {
    expect(
      eventEnvelopeSchema.safeParse({
        ...validEvent,
        name: 'WEATHER_ALERT',
        priority: 'critical',
        payload: {
          headline: 'Lightning delay in effect',
          severity: 'critical',
          manualHold: true
        },
        options: {
          queueBehavior: 'interrupt',
          requestedZone: 'Zone F',
          sponsorBehavior: 'suppressed',
          manualHold: true
        }
      })
    ).toMatchObject({ success: true });
  });

  it('validates event source and sourceType literals', () => {
    expect(eventSourceSchema.parse('operator_panel')).toBe('operator_panel');
    expect(eventSourceTypeSchema.parse('human')).toBe('human');
    expect(eventSourceSchema.safeParse('operator')).toMatchObject({ success: false });
    expect(eventSourceTypeSchema.safeParse('person')).toMatchObject({ success: false });
  });
});
