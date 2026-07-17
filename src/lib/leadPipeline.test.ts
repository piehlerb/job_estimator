import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  buildDedupeKey,
  normalizeGhlWebhook,
  nextLeadStageForEvent,
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

  test('moves new lead to booked but never moves won lead backward', () => {
    assert.equal(nextLeadStageForEvent('New', 'appointment.booked'), 'Estimate Booked');
    assert.equal(nextLeadStageForEvent('Won', 'appointment.canceled'), 'Won');
  });

  test('does not overwrite existing attribution with blank webhook values', () => {
    assert.equal(shouldOverwriteLeadValue('Facebook', ''), false);
    assert.equal(shouldOverwriteLeadValue(undefined, 'Google Ads'), true);
  });
});
