# GoHighLevel call and text tracking

Calls and texts that happen in GoHighLevel are recorded on the matching lead in
Job Estimator, next to the attempts logged by hand with the **+ Call** / **+ Text**
buttons. The Leads page counts, the "last contacted" filter, and anything built
on them later (reminders, follow-up rules) read one list: `leads.contact_log`.

## Endpoint

```
POST https://<project-ref>.supabase.co/functions/v1/ghl-webhook
```

This is the same function that already receives lead and appointment webhooks,
and it authenticates the same way: the webhook secret of an active row in
`ghl_webhook_sources`. The secret can be sent as either

- the `x-ghl-webhook-secret` request header (workflow webhooks), or
- a `secret` query-string parameter, `...?secret=<secret>`, for senders that
  cannot set headers (app webhooks). URL-encode it if it has special characters.

## Option A — app webhooks (covers everything)

A private app in the GHL developer marketplace can subscribe to the
`OutboundMessage` and `InboundMessage` webhook events. These fire for every
message on the location, including texts typed by hand in Conversations and
calls placed from the dialer, which no workflow trigger reports.

1. marketplace.gohighlevel.com → **My Apps → Create App**. Type **Private**,
   target **Sub-account**.
2. **Scopes:** `conversations/message.readonly` (add `conversations.readonly` if
   the form asks for it).
3. **Webhooks:** URL `https://<project-ref>.supabase.co/functions/v1/ghl-webhook?secret=<secret>`,
   events **OutboundMessage** and **InboundMessage**.
4. Install the app on the sub-account.

Nothing else is configured: the payload already carries what is needed
(`contactId`, `messageId`, `messageType`, `direction`, `dateAdded`, `status`,
`callStatus`, `callDuration`). Message bodies are not copied onto the lead.

Only `CALL`, `VoiceMail` and `SMS` messages are recorded. Email, chat and social
messages are acknowledged with `200` and not stored.

## Option B — workflow webhooks

Use the same **Webhook** workflow action the lead and appointment workflows use,
with the `x-ghl-webhook-secret` header, and identify the event with custom data:

| Custom data key | Value | Notes |
| --- | --- | --- |
| `event_type` | `contact.call` or `contact.text` | Required |
| `direction` | `outbound` or `inbound` | Optional, defaults to `outbound` |
| `call_status` | e.g. `{{call.status}}` or fixed text | Optional outcome label |
| `call_duration` | seconds | Optional |
| `message_id` | a unique id for the message | Optional; lets a repeat delivery update the same entry |

`event_type` may carry the direction inline instead: `contact.call.outbound`,
`contact.text.inbound`.

Suggested workflows:

- **Call Details** trigger (filter direction = outgoing) → Webhook with
  `event_type = contact.call`, `direction = outbound`.
- **Customer Replied** trigger (filter reply channel = SMS) → Webhook with
  `event_type = contact.text`, `direction = inbound`.
- A **Webhook** step placed right after each **Send SMS** step in an automation,
  with `event_type = contact.text`.

Workflows have no trigger for a text a person sends by hand from Conversations.
Use Option A if those need to be counted. Do not run both options for the same
kind of event, or each call will be recorded twice (workflow payloads carry no
message id to match them up).

## What gets recorded

Each call or text becomes one element of `leads.contact_log`:

```json
{
  "id": "ghl_<message id>",
  "channel": "call",
  "at": "2026-11-10T15:30:00.000Z",
  "direction": "outbound",
  "source": "ghl",
  "status": "voicemail",
  "duration_seconds": 42
}
```

- The lead is found by GHL contact id (then phone, then email). A call or text
  for a contact with no lead is stored in `ghl_webhook_events` as `ignored` and
  creates nothing.
- An **outbound** call or text moves a lead from **New** to **Contact
  Attempted**, the same as logging one by hand. Nothing else changes the stage.
- **Inbound** calls and texts are recorded but are not counted as attempts and do
  not change "last contacted". The Leads page shows them as "Heard back ...".
- GHL reports a call more than once as its status settles. Deliveries for the
  same message id update the one entry.
- Entries with `source: "ghl"` are read-only in the app, and the database puts
  them back if a save from a device with an out-of-date copy of the lead would
  drop them (`preserve_ghl_contact_log` trigger).

Every delivery is kept in `ghl_webhook_events` with its raw payload and a
`processing_status`, which is the place to look when something did not show up.
