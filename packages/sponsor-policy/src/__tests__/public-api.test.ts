import { describe, expect, it } from 'vitest';

import {
  evaluateSponsorPolicy,
  resolveSponsorAttachment,
  sponsorConfigSchema,
  sponsorPolicyDecisionSchema,
  transitionSponsorFulfillment,
  validateSponsorConfig,
  type SponsorConfig
} from '..';
import type { ISODateTime } from '@quacktrack/core';
import type { BroadcastObject } from '@quacktrack/objects';

const timestamp = '2026-06-13T23:00:00.000Z' as ISODateTime;

const config = {
  configVersion: '1.0',
  enabled: true,
  defaultDisplayMode: 'logo',
  sponsors: [
    {
      sponsorId: 'sp_001',
      sponsorName: 'Acme Sports',
      sponsorSlot: 'lower-third',
      campaignId: 'camp_001',
      logoPath: '/sponsors/acme.svg',
      requiredDuration: 5000
    }
  ],
  campaigns: [
    {
      campaignId: 'camp_001',
      sponsorId: 'sp_001',
      requiredDuration: 5000,
      active: true
    }
  ]
} as unknown as SponsorConfig;

function createObject(type: string, payload: Record<string, unknown>, priority = 'normal'): BroadcastObject {
  const familyByType: Record<string, string> = {
    player: 'Person Context',
    stat: 'Performance Context',
    interview: 'Person Context',
    weather: 'Game Context',
    injury: 'Game Context',
    breaking: 'Game Context',
    sponsor: 'Commercial Context'
  };

  return {
    id: `obj_${type}`,
    objectVersion: 1,
    schemaVersion: '1.0',
    type,
    family: familyByType[type],
    lifecycle: 'VALIDATED',
    priority,
    payload,
    analytics: {
      impressions: 0,
      displayTime: 0,
      interruptionCount: 0
    },
    source: {
      eventId: `evt_${type}`,
      eventName: 'SPONSOR_MOMENT',
      source: 'operator_panel',
      sourceType: 'human',
      timestamp
    },
    createdAt: timestamp
  } as unknown as BroadcastObject;
}

describe('@quacktrack/sponsor-policy public API', () => {
  it('validates sponsor config', () => {
    expect(validateSponsorConfig(config)).toMatchObject({ success: true });
    expect(sponsorConfigSchema.safeParse({ configVersion: '1.0', sponsors: [], campaigns: [] })).toMatchObject({
      success: true
    });
    expect(sponsorConfigSchema.safeParse({ sponsors: [], campaigns: [] })).toMatchObject({ success: false });
  });

  it('suppresses weather sponsor with a reason', () => {
    const decision = evaluateSponsorPolicy({
      object: createObject('weather', { headline: 'Lightning delay', severity: 'critical' }),
      config
    });

    expect(decision).toMatchObject({
      policy: 'suppressed',
      allowed: false,
      suppressionReasons: ['weather_safety_context']
    });
    expect(sponsorPolicyDecisionSchema.safeParse(decision)).toMatchObject({ success: true });
  });

  it('suppresses injury sponsor with a reason', () => {
    const decision = evaluateSponsorPolicy({
      object: createObject('injury', { headline: 'Player helped off field' }),
      config
    });

    expect(decision.allowed).toBe(false);
    expect(decision.suppressionReasons).toContain('injury_sensitive_context');
  });

  it('suppresses non-critical sponsor in emergency scene', () => {
    const decision = evaluateSponsorPolicy({
      object: createObject('player', { playerName: 'Alex Rivera', team: 'QUACKTRACK' }),
      config,
      sceneType: 'emergency'
    });

    expect(decision.allowed).toBe(false);
    expect(decision.suppressionReasons).toContain('emergency_scene');
  });

  it('permits player, stat, and interview when config allows', () => {
    const playerDecision = evaluateSponsorPolicy({
      object: createObject('player', { playerName: 'Alex Rivera', team: 'QUACKTRACK' }),
      config
    });
    const statDecision = evaluateSponsorPolicy({
      object: createObject('stat', { primaryMetric: { value: 12, label: 'Tackles' } }),
      config
    });
    const interviewDecision = evaluateSponsorPolicy({
      object: createObject('interview', { subjectName: 'Alex Rivera', segmentLabel: 'Halftime' }),
      config
    });

    expect(playerDecision.allowed).toBe(true);
    expect(statDecision.allowed).toBe(true);
    expect(interviewDecision.allowed).toBe(true);
  });

  it('requires sponsor identity for sponsor objects', () => {
    const decision = evaluateSponsorPolicy({
      object: createObject('sponsor', { sponsorName: 'Acme Sports', sponsorSlot: 'lower-third', sponsorId: 'sp_001' }, 'low'),
      config
    });
    const missingIdentityDecision = evaluateSponsorPolicy({
      object: createObject('sponsor', { sponsorName: 'Acme Sports', sponsorSlot: 'lower-third' }, 'low'),
      config: { ...config, sponsors: [] }
    });

    expect(decision).toMatchObject({
      policy: 'required',
      allowed: true,
      required: true
    });
    expect(missingIdentityDecision.allowed).toBe(false);
    expect(missingIdentityDecision.suppressionReasons).toContain('missing_sponsor_identity');
  });

  it('returns fallback when required logo is missing but fallback text exists', () => {
    const decision = evaluateSponsorPolicy({
      object: createObject('player', { playerName: 'Alex Rivera', team: 'QUACKTRACK' }),
      config: {
        ...config,
        requireLogoForDisplay: true,
        sponsors: [
          {
            sponsorId: 'sp_002',
            sponsorName: 'Text Sponsor',
            sponsorSlot: 'lower-third',
            textFallback: 'Presented by Text Sponsor'
          }
        ]
      } as unknown as SponsorConfig
    });

    expect(decision).toMatchObject({
      policy: 'fallback',
      allowed: true,
      displayMode: 'fallback_text',
      fallbackText: 'Presented by Text Sponsor'
    });
  });

  it('resolves sponsor attachment without mutating the object', () => {
    const object = createObject('player', { playerName: 'Alex Rivera', team: 'QUACKTRACK' });
    const attachment = resolveSponsorAttachment({ object, config });

    expect(attachment).toMatchObject({
      sponsorId: 'sp_001',
      sponsorName: 'Acme Sports',
      sponsorSlot: 'lower-third',
      policy: 'permitted',
      fulfillmentStatus: 'pending'
    });
    expect(object).not.toHaveProperty('sponsor');
  });

  it('transitions interrupted sponsor fulfillment outcomes', () => {
    expect(
      transitionSponsorFulfillment('pending', {
        from: 'pending',
        action: 'interrupt',
        timestamp
      })
    ).toBe('interrupted');
    expect(
      transitionSponsorFulfillment('interrupted', {
        from: 'interrupted',
        action: 'reschedule',
        timestamp,
        rescheduledFor: '2026-06-13T23:05:00.000Z' as ISODateTime
      })
    ).toBe('rescheduled');
    expect(transitionSponsorFulfillment('interrupted', { from: 'interrupted', action: 'miss', timestamp })).toBe(
      'missed'
    );
    expect(transitionSponsorFulfillment('interrupted', { from: 'interrupted', action: 'fulfill', timestamp })).toBe(
      'fulfilled'
    );
  });
});
