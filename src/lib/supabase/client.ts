import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // Prevent auto-detection on page load so the PKCE verifier isn't
        // consumed before the callback page explicitly calls exchangeCodeForSession.
        detectSessionInUrl: false,
      },
    },
  );
}
