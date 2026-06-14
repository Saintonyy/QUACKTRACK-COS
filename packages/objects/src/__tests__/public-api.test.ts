import { describe, expect, it } from 'vitest';

import {
  broadcastObjectSchema,
  compoundPayloadSchema,
  injuryPayloadSchema,
  isStaleObjectUpdate,
  playerPayloadSchema,
  sponsorAttachmentSchema,
  sponsorPayloadSchema,
  statPayloadSchema,
  validateBroadcastObject,
  validateSponsorAttachment,
  weatherPayloadSchema
} from '..';

const timestamp = '2026-06-13T23:00:00.000Z';

const baseObject = {
  id: 'obj_001',
  objectVersion: 1,
  schemaVersion: '1.0',
  lifecycle: 'CREATED',
  priority: 'normal',
  analytics: {
    impressions: 0,
    displayTime: 0,
    interruptionCount: 0
  },
  source: {
    eventId: 'evt_001',
    eventName: 'PLAYER_INTRODUCTION',
    source: 'operator_panel',
    sourceType: 'human',
    timestamp
  },
  createdAt: timestamp
};

const validPlayerObject = {
  ...baseObject,
  type: 'player',
  family: 'Person Context',
  payload: {
    playerName: 'Alex Rivera',
    team: 'QUACKTRACK'
  }
};

describe('@quacktrack/objects public API', () => {
  it('requires playerName and team for PlayerPayload', () => {
    expect(playerPayloadSchema.safeParse({ playerName: 'Alex Rivera', team: 'QUACKTRACK' })).toMatchObject({
      success: true
    });
    expect(playerPayloadSchema.safeParse({ playerName: 'Alex Rivera' })).toMatchObject({ success: false });
    expect(playerPayloadSchema.safeParse({ team: 'QUACKTRACK' })).toMatchObject({ success: false });
  });

  it('requires primaryMetric.value and primaryMetric.label for StatPayload', () => {
    expect(statPayloadSchema.safeParse({ primaryMetric: { value: 12, label: 'Tackles' } })).toMatchObject({
      success: true
    });
    expect(statPayloadSchema.safeParse({ primaryMetric: { value: 12 } })).toMatchObject({ success: false });
    expect(statPayloadSchema.safeParse({ primaryMetric: { label: 'Tackles' } })).toMatchObject({ success: false });
  });

  it('requires headline and severity for WeatherPayload', () => {
    expect(weatherPayloadSchema.safeParse({ headline: 'Lightning delay', severity: 'critical' })).toMatchObject({
      success: true
    });
    expect(weatherPayloadSchema.safeParse({ headline: 'Lightning delay' })).toMatchObject({ success: false });
    expect(weatherPayloadSchema.safeParse({ severity: 'critical' })).toMatchObject({ success: false });
  });

  it('requires headline for InjuryPayload', () => {
    expect(injuryPayloadSchema.safeParse({ headline: 'Player helped off field' })).toMatchObject({
      success: true
    });
    expect(injuryPayloadSchema.safeParse({ relatedPlayer: 'Alex Rivera' })).toMatchObject({ success: false });
  });

  it('requires sponsorName and sponsorSlot for SponsorPayload', () => {
    expect(sponsorPayloadSchema.safeParse({ sponsorName: 'Acme', sponsorSlot: 'lower-third' })).toMatchObject({
      success: true
    });
    expect(sponsorPayloadSchema.safeParse({ sponsorName: 'Acme' })).toMatchObject({ success: false });
    expect(sponsorPayloadSchema.safeParse({ sponsorSlot: 'lower-third' })).toMatchObject({ success: false });
  });

  it('requires payload to match BroadcastObject.type', () => {
    expect(validateBroadcastObject(validPlayerObject)).toMatchObject({ success: true });
    expect(
      broadcastObjectSchema.safeParse({
        ...validPlayerObject,
        payload: {
          primaryMetric: {
            value: 12,
            label: 'Tackles'
          }
        }
      })
    ).toMatchObject({ success: false });
  });

  it('requires new objectVersion to start at 1 or greater', () => {
    expect(broadcastObjectSchema.safeParse(validPlayerObject)).toMatchObject({ success: true });
    expect(
      broadcastObjectSchema.safeParse({
        ...validPlayerObject,
        objectVersion: 0
      })
    ).toMatchObject({ success: false });
  });

  it('detects stale object updates', () => {
    expect(isStaleObjectUpdate({ objectVersion: 3 }, { objectVersion: 2 })).toBe(true);
    expect(isStaleObjectUpdate({ objectVersion: 3 }, { objectVersion: 3 })).toBe(false);
    expect(isStaleObjectUpdate(3, 4)).toBe(false);
  });

  it('validates SponsorAttachment fulfillment status', () => {
    const attachment = {
      sponsorId: 'sp_001',
      sponsorName: 'Acme',
      sponsorSlot: 'lower-third',
      displayMode: 'logo',
      policy: 'permitted',
      fulfillmentStatus: 'pending'
    };

    expect(validateSponsorAttachment(attachment)).toMatchObject({ success: true });
    expect(
      sponsorAttachmentSchema.safeParse({
        ...attachment,
        fulfillmentStatus: 'done'
      })
    ).toMatchObject({ success: false });
  });

  it('requires compound parent, composition type, and child references or payloads', () => {
    expect(
      compoundPayloadSchema.safeParse({
        parentObjectId: 'obj_parent',
        compositionType: 'parent_child',
        childObjectIds: ['obj_child']
      })
    ).toMatchObject({ success: true });

    expect(
      compoundPayloadSchema.safeParse({
        parentObjectId: 'obj_parent',
        compositionType: 'parent_child',
        childPayloads: [{ playerName: 'Alex Rivera', team: 'QUACKTRACK' }]
      })
    ).toMatchObject({ success: true });

    expect(
      compoundPayloadSchema.safeParse({
        compositionType: 'parent_child',
        childObjectIds: ['obj_child']
      })
    ).toMatchObject({ success: false });

    expect(
      compoundPayloadSchema.safeParse({
        parentObjectId: 'obj_parent',
        childObjectIds: ['obj_child']
      })
    ).toMatchObject({ success: false });

    expect(
      compoundPayloadSchema.safeParse({
        parentObjectId: 'obj_parent',
        compositionType: 'parent_child'
      })
    ).toMatchObject({ success: false });
  });
});
