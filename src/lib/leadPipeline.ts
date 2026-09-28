// The lead pipeline is shared with the ghl-webhook edge function, which runs on
// Deno and can only import files under supabase/functions/. This re-export keeps
// one copy of the logic for both the app and the webhook.
export * from '../../supabase/functions/_shared/leadPipeline.js';
