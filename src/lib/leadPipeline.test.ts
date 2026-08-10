import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  buildDedupeKey,
  normalizeGhlWebhook,
  nextLeadStageForEvent,
  resolveLeadAddressMerge,
  shouldOverwriteLeadValue,
} from './leadPipeline.js';

describe('GHL lead pipeline', () => {
  test('derives appointment dedupe key from event contact appointment and scheduled time', () => {
    assert.equal(
      buildDedupeKey({
        eventType: 'appointment.booked',
        ghlContactId: 'contact-1',
        ghlAppointmentId: 'appt-1',
        scheduledStartAt: '2026-07-01T14:00:00.000Z',
      }),
      'appointment.booked:contact-1:appt-1:2026-07-01T14:00:00.000Z'
    );
  });

  test('normalizes source and identity fields from common GHL payload shapes', () => {
    const normalized = normalizeGhlWebhook({
      event_type: 'lead.created',
      contact_id: 'abc',
      full_name: '  Jane Doe  ',
      phone: '(555) 222-1111',
      email: 'JANE@EXAMPLE.COM',
      source: 'Facebook',
      campaign: 'Garage Floors',
    });

    assert.equal(normalized.eventType, 'lead.created');
    assert.equal(normalized.lead.name, 'Jane Doe');
    assert.equal(normalized.lead.phone, '5552221111');
    assert.equal(normalized.lead.email, 'jane@example.com');
    assert.equal(normalized.lead.source, 'Facebook');
  });

  test('uses the contact Lead Source instead of opaque attribution session data', () => {
    const normalized = normalizeGhlWebhook({
      contact_id: 'abc',
      source: 'Top-level webhook source',
      contact: {
        source: 'Customer Referral',
        attributionSource: {
          sessionSource: 'gclid:opaque-session-id',
          medium: 'cpc',
        },
      },
    });

    assert.equal(normalized.lead.source, 'Customer Referral');
  });

  test('reads the contact_source field from the live GHL workflow payload shape', () => {
    const normalized = normalizeGhlWebhook({
      contact_id: 'abc',
      contact_source: 'EZMedia',
      attributionSource: {
        sessionSource: 'CRM UI',
        medium: 'manual',
      },
      contact: {
        attributionSource: {
          sessionSource: 'CRM UI',
          medium: 'manual',
        },
      },
    });

    assert.equal(normalized.lead.source, 'EZMedia');
  });

  test('reads GHL standard webhook custom data and nested appointment fields', () => {
    const normalized = normalizeGhlWebhook({
      contact_id: 'abc',
      full_name: 'Jane Doe',
      email: 'jane@example.com',
      customData: {
        event_type: 'appointment.booked',
      },
      triggerData: {
        id: 'appt-123',
        startTime: '2026-07-01T14:00:00Z',
        endTime: '2026-07-01T15:00:00Z',
        calendarName: 'Estimates',
      },
    });

    assert.equal(normalized.eventType, 'appointment.booked');
    assert.equal(normalized.dedupeKey, 'appointment.booked:abc:appt-123:2026-07-01T14:00:00.000Z');
    assert.equal(normalized.appointment?.ghlAppointmentId, 'appt-123');
    assert.equal(normalized.appointment?.calendarName, 'Estimates');
  });

  test('reads GHL calendar object appointment identity', () => {
    const normalized = normalizeGhlWebhook({
      contact_id: 'abc',
      full_name: 'Jane Doe',
      email: 'jane@example.com',
      customData: {
        event_type: 'appointment.booked',
      },
      calendar: {
        appointmentId: 'appt-456',
        startTime: '2026-07-01T14:00:00Z',
        endTime: '2026-07-01T15:00:00Z',
        calendarName: 'Sales Appointments',
        created_by: 'Brian Piehler',
      },
    });

    assert.equal(normalized.eventType, 'appointment.booked');
    assert.equal(normalized.dedupeKey, 'appointment.booked:abc:appt-456:2026-07-01T14:00:00.000Z');
    assert.equal(normalized.appointment?.scheduledStartAt, '2026-07-01T14:00:00.000Z');
    assert.equal(normalized.appointment?.scheduledEndAt, '2026-07-01T15:00:00.000Z');
    assert.equal(normalized.appointment?.calendarName, 'Sales Appointments');
    assert.equal(normalized.appointment?.assignedUser, 'Brian Piehler');
  });

  test('interprets naive GHL appointment times in the payload timezone, not the runtime timezone', () => {
    // GHL sends bare wall time plus the booking timezone in a separate field.
    // 9:00 AM Eastern in August is EDT (UTC-4), so the instant is 13:00Z.
    const normalized = normalizeGhlWebhook({
      contact_id: 'abc',
      email: 'jane@example.com',
      timezone: 'America/New_York',
      customData: { event_type: 'appointment.booked' },
      calendar: {
        appointmentId: 'appt-789',
        startTime: '2026-08-13T09:00:00',
        endTime: '2026-08-13T09:30:00',
        selectedTimezone: 'US/Eastern',
      },
    });

    assert.equal(normalized.appointment?.scheduledStartAt, '2026-08-13T13:00:00.000Z');
    assert.equal(normalized.appointment?.scheduledEndAt, '2026-08-13T13:30:00.000Z');
  });

  test('applies standard time offset for naive appointment times outside DST', () => {
    // 9:00 AM Eastern in January is EST (UTC-5), so the instant is 14:00Z.
    const normalized = normalizeGhlWebhook({
      contact_id: 'abc',
      email: 'jane@example.com',
      customData: { event_type: 'appointment.booked' },
      calendar: {
        appointmentId: 'appt-winter',
        startTime: '2026-01-14T09:00:00',
        selectedTimezone: 'US/Eastern',
      },
    });

    assert.equal(normalized.appointment?.scheduledStartAt, '2026-01-14T14:00:00.000Z');
  });

  test('honors a non-Eastern booking timezone from the payload', () => {
    const normalized = normalizeGhlWebhook({
      contact_id: 'abc',
      email: 'jane@example.com',
      customData: { event_type: 'appointment.booked' },
      calendar: {
        appointmentId: 'appt-pacific',
        startTime: '2026-08-13T09:00:00',
        selectedTimezone: 'America/Los_Angeles',
      },
    });

    assert.equal(normalized.appointment?.scheduledStartAt, '2026-08-13T16:00:00.000Z');
  });

  test('leaves appointment times that already carry an offset untouched', () => {
    const normalized = normalizeGhlWebhook({
      contact_id: 'abc',
      email: 'jane@example.com',
      customData: { event_type: 'appointment.booked' },
      calendar: {
        appointmentId: 'appt-offset',
        startTime: '2026-08-13T09:00:00-04:00',
        endTime: '2026-08-13T09:30:00Z',
        selectedTimezone: 'US/Eastern',
      },
    });

    assert.equal(normalized.appointment?.scheduledStartAt, '2026-08-13T13:00:00.000Z');
    assert.equal(normalized.appointment?.scheduledEndAt, '2026-08-13T09:30:00.000Z');
  });

  test('falls back to Eastern when the payload names no usable timezone', () => {
    const normalized = normalizeGhlWebhook({
      contact_id: 'abc',
      email: 'jane@example.com',
      customData: { event_type: 'appointment.booked' },
      calendar: {
        appointmentId: 'appt-no-tz',
        startTime: '2026-08-13T09:00:00',
        selectedTimezone: 'Not/AZone',
      },
    });

    assert.equal(normalized.appointment?.scheduledStartAt, '2026-08-13T13:00:00.000Z');
  });

  test('moves new lead to booked but never moves won lead backward', () => {
    assert.equal(nextLeadStageForEvent('New', 'appointment.booked'), 'Estimate Booked');
    assert.equal(nextLeadStageForEvent('Won', 'appointment.canceled'), 'Won');
  });

  test('does not overwrite existing attribution with blank webhook values', () => {
    assert.equal(shouldOverwriteLeadValue('Facebook', ''), false);
    assert.equal(shouldOverwriteLeadValue(undefined, 'Google Ads'), true);
  });

  // The payload shapes below mirror the real ones stored in ghl_webhook_events:
  // top-level snake_case keys, with the flattened full_address sent alongside the
  // discrete fields rather than instead of them.
  test('reads the discrete address fields GHL sends rather than parsing full_address', () => {
    const normalized = normalizeGhlWebhook({
      contact_id: 'abc',
      full_name: 'Jane Doe',
      address1: '38 Muirfield Dr',
      city: 'Stratham',
      state: 'NH',
      postal_code: '03885',
      country: 'US',
      full_address: '38 Muirfield Dr, Stratham, NH 03885',
    });

    assert.equal(normalized.lead.street, '38 Muirfield Dr');
    assert.equal(normalized.lead.city, 'Stratham');
    assert.equal(normalized.lead.state, 'NH');
    assert.equal(normalized.lead.zip, '03885');
    assert.equal(normalized.lead.addressParseTier, 'A');
    // The raw string is preserved, not replaced by the structured projection.
    assert.equal(normalized.lead.address, '38 Muirfield Dr, Stratham, NH 03885');
  });

  test('normalizes state casing that appears in real payloads', () => {
    const normalized = normalizeGhlWebhook({
      contact_id: 'abc',
      city: 'Dover',
      state: 'Nh',
      postal_code: '03820',
    });

    assert.equal(normalized.lead.state, 'NH');
    assert.equal(normalized.lead.addressParseTier, 'A');
  });

  test('drops a spelled-out state instead of guessing at a two-letter code', () => {
    const normalized = normalizeGhlWebhook({
      contact_id: 'abc',
      city: 'Buxton',
      state: 'Maine',
      postal_code: '04093',
    });

    // Left for the address parser to resolve from the raw string; writing an
    // unvalidated value would fail the leads.state CHECK constraint on push.
    assert.equal(normalized.lead.state, undefined);
    assert.equal(normalized.lead.addressParseTier, undefined);
    // The rest of the address must still be captured.
    assert.equal(normalized.lead.city, 'Buxton');
    assert.equal(normalized.lead.zip, '04093');
  });

  test('does not let a single character widen into a valid-looking state code', () => {
    // 'ß'.toUpperCase() is 'SS', and the 'ﬅ' ligature becomes 'ST' — a real state
    // code manufactured out of one junk character.
    assert.equal(normalizeGhlWebhook({ contact_id: 'a', state: 'ß' }).lead.state, undefined);
    assert.equal(normalizeGhlWebhook({ contact_id: 'a', state: 'ﬅ' }).lead.state, undefined);
  });

  test('collapses ZIP+4 to five digits and rejects anything that is not a US ZIP', () => {
    const zipOf = (postal_code: unknown) =>
      normalizeGhlWebhook({ contact_id: 'a', city: 'York', state: 'ME', postal_code }).lead.zip;

    assert.equal(zipOf('03909-1234'), '03909');
    assert.equal(zipOf('123456'), undefined);
    // Every ME/NH ZIP starts with 0, so a JSON *number* has lost a leading zero.
    // Padding is recovery, not a guess: JSON numbers cannot carry leading zeros.
    assert.equal(zipOf(3909), '03909');
    assert.equal(zipOf('3909'), '03909');
    // But digits salvaged from mixed text are not a ZIP. 'K1A 0B1' reduces to
    // '101', which must not be padded into the real ZIP 00101.
    assert.equal(zipOf('K1A 0B1'), undefined);
    assert.equal(zipOf('apt 12'), undefined);
  });

  test('requires all three of zip, city and state before claiming tier A', () => {
    // Only the city+state-without-zip direction was covered before.
    const noCity = normalizeGhlWebhook({ contact_id: 'a', state: 'ME', postal_code: '04038' }).lead;
    assert.equal(noCity.zip, '04038');
    assert.equal(noCity.addressParseTier, undefined);

    const noState = normalizeGhlWebhook({ contact_id: 'a', city: 'Gorham', postal_code: '04038' }).lead;
    assert.equal(noState.zip, '04038');
    assert.equal(noState.addressParseTier, undefined);
  });

  test('leaves a partial address set untiered so the parser still visits the row', () => {
    const normalized = normalizeGhlWebhook({
      contact_id: 'abc',
      city: 'Seabrook',
      state: 'NH',
      full_address: 'Seabrook, NH',
    });

    assert.equal(normalized.lead.city, 'Seabrook');
    assert.equal(normalized.lead.state, 'NH');
    assert.equal(normalized.lead.zip, undefined);
    assert.equal(normalized.lead.addressParseTier, undefined);
  });

  test('yields no street when GHL sends none, without inventing one from full_address', () => {
    // The common real shape: no address1, and full_address is only "City, ST ZIP".
    const normalized = normalizeGhlWebhook({
      contact_id: 'abc',
      city: 'Gorham',
      state: 'ME',
      postal_code: '04038',
      full_address: 'Gorham, ME 04038',
    });

    assert.equal(normalized.lead.street, undefined);
    assert.equal(normalized.lead.address, 'Gorham, ME 04038');
    // The rest is still captured, so this can't pass by capturing nothing at all.
    assert.equal(normalized.lead.city, 'Gorham');
    assert.equal(normalized.lead.zip, '04038');
    assert.equal(normalized.lead.addressParseTier, 'A');
  });

  test('carries no address fields at all when the payload has none', () => {
    const normalized = normalizeGhlWebhook({ contact_id: 'abc', full_name: 'Jane Doe' });

    assert.equal(normalized.lead.address, undefined);
    assert.equal(normalized.lead.street, undefined);
    assert.equal(normalized.lead.city, undefined);
    assert.equal(normalized.lead.state, undefined);
    assert.equal(normalized.lead.zip, undefined);
    assert.equal(normalized.lead.addressParseTier, undefined);
    // Contrast with the tier-A test above: this payload really has no address,
    // rather than the reader having failed to find one.
    assert.equal(normalized.lead.name, 'Jane Doe');
  });

  const storedStratham = {
    address: '38 Muirfield Dr, Stratham, NH 03885',
    street: '38 Muirfield Dr',
    street2: 'Unit 4',
    city: 'Stratham',
    state: 'NH',
    zip: '03885',
    address_parse_tier: 'A',
    address_verified_at: null,
  };

  test('replaces the whole address group when the incoming town contradicts the stored one', () => {
    // The dangerous real shape: city/state/zip present, no address1. Merging these
    // columns field-by-field would keep Stratham's street under a Dover address.
    const patch = resolveLeadAddressMerge(storedStratham, {
      address: 'Dover, NH 03820',
      street: undefined,
      city: 'Dover',
      state: 'NH',
      zip: '03820',
      addressParseTier: 'A',
    });

    assert.equal(patch.city, 'Dover');
    assert.equal(patch.zip, '03820');
    assert.equal(patch.street, null, 'the previous street must not survive into a new town');
    assert.equal(patch.street2, null, 'a unit number belongs to the address it arrived with');
  });

  test('does not claim tier A when the replacing address is only partial', () => {
    const patch = resolveLeadAddressMerge(storedStratham, {
      address: 'Seabrook, NH',
      city: 'Seabrook',
      state: 'NH',
      zip: undefined,
      addressParseTier: undefined,
    });

    assert.equal(patch.city, 'Seabrook');
    assert.equal(patch.zip, null, "the old town's ZIP must not be reused");
    assert.equal(patch.address_parse_tier, null, 'a partial address is not deterministic');
  });

  test('fills gaps without disturbing anything when the same address arrives again', () => {
    const stored = { ...storedStratham, street: null, street2: null };
    const patch = resolveLeadAddressMerge(stored, {
      address: '38 Muirfield Dr, Stratham, NH 03885',
      street: '38 Muirfield Dr',
      city: 'Stratham',
      state: 'NH',
      zip: '03885',
      addressParseTier: 'A',
    });

    assert.equal(patch.street, '38 Muirfield Dr');
    // Unchanged fields are absent from the patch rather than rewritten.
    assert.equal('city' in patch, false);
    assert.equal('zip' in patch, false);
  });

  test('keeps a stored street when a later event repeats the town but omits address1', () => {
    const patch = resolveLeadAddressMerge(storedStratham, {
      address: 'Stratham, NH 03885',
      street: undefined,
      city: 'Stratham',
      state: 'NH',
      zip: '03885',
      addressParseTier: 'A',
    });

    // Nothing contradicts, so this must not null the street we already have.
    assert.equal(patch.street, undefined);
    assert.equal(patch.street2, undefined);
  });

  test('writes every address field for a lead that has none stored yet', () => {
    const patch = resolveLeadAddressMerge(null, {
      address: '38 Muirfield Dr, Stratham, NH 03885',
      street: '38 Muirfield Dr',
      city: 'Stratham',
      state: 'NH',
      zip: '03885',
      addressParseTier: 'A',
    });

    assert.equal(patch.street, '38 Muirfield Dr');
    assert.equal(patch.city, 'Stratham');
    assert.equal(patch.state, 'NH');
    assert.equal(patch.zip, '03885');
    assert.equal(patch.address_parse_tier, 'A');
  });

  test('refuses to touch a confirmed address, and treats hand-entry as confirmation', () => {
    const incoming = {
      address: '12 Elm St, Dover, NH 03820',
      street: '12 Elm St',
      city: 'Dover',
      state: 'NH',
      zip: '03820',
      addressParseTier: 'A' as const,
    };

    assert.deepEqual(
      resolveLeadAddressMerge({ ...storedStratham, address_verified_at: '2026-08-01T00:00:00.000Z' }, incoming),
      {},
      'a confirmed row is off-limits'
    );
    assert.deepEqual(
      resolveLeadAddressMerge({ ...storedStratham, address_parse_tier: 'M' }, incoming),
      {},
      'tier M is protective on its own'
    );
  });

  test('leaves a stored address alone when the webhook carries no address at all', () => {
    assert.deepEqual(resolveLeadAddressMerge(storedStratham, {}), {});
  });
});
