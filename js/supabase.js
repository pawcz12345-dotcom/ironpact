/**
 * IronPact — Supabase Client Initialisation
 *
 * Requires the Supabase CDN script to be loaded first:
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 *
 * Exposes window.Supabase as the initialised client.
 */

(function () {
  const SUPABASE_URL = 'https://pwmqljgqifypjkhezaex.supabase.co';
  const SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
    'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3bXFsamdxaWZ5cGpraGV6YWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4ODgyNzMsImV4cCI6MjA4NzQ2NDI3M30.' +
    'bIEGLOJ5FgubHDlHz2xUKNyIAp6y9Yn_x0igbaQ287o';

  if (!window.supabase) {
    console.error('[IronPact] Supabase CDN script not loaded. Add the script tag before supabase.js.');
    return;
  }

  // createClient is exposed globally by the CDN build as window.supabase.createClient
  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      // Persist session in localStorage so it survives page reloads
      persistSession: true,
      autoRefreshToken: true,
      // Use the GitHub Pages URL as the redirect target after OAuth
      redirectTo: 'https://pawcz12345-dotcom.github.io/ironpact/',
    },
  });

  // Expose as window.Supabase (capital S) to match usage in other modules
  window.Supabase = client;
})();
