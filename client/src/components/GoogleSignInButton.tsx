interface GoogleSignInButtonProps {
  label?: string;
  /** Path inside the app to return to after successful Google sign-in. */
  returnTo?: string;
}

/**
 * Kicks off the Google OAuth flow by navigating to the server endpoint. The
 * server then 302s to Google's consent page; after consent Google sends the
 * user back to /api/auth/google/callback, which sets a session cookie and
 * redirects into the app.
 *
 * A plain anchor is intentional — SPAs can't use `fetch` for this because the
 * browser needs to do the full navigation so the eventual Set-Cookie lands
 * on this origin, and so Google's consent UI can render normally.
 */
export function GoogleSignInButton({
  label = "Continue with Google",
  returnTo = "/"
}: GoogleSignInButtonProps) {
  const href = `/api/auth/google/start?returnTo=${encodeURIComponent(returnTo)}`;
  return (
    <a className="google-btn" href={href} role="button">
      <svg
        className="google-btn-icon"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 48 48"
        aria-hidden="true"
      >
        <path
          fill="#4285F4"
          d="M43.6 20.5H42V20H24v8h11.3c-1.7 4.8-6.2 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z"
        />
        <path
          fill="#34A853"
          d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
        />
        <path
          fill="#FBBC05"
          d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.2C29.1 35.2 26.7 36 24 36c-5.1 0-9.5-3.2-11.2-7.9L6.2 33C9.6 39.6 16.3 44 24 44z"
        />
        <path
          fill="#EA4335"
          d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.4 4.3-4.5 5.6l6.3 5.2C41 35.9 44 30.4 44 24c0-1.2-.1-2.4-.4-3.5z"
        />
      </svg>
      <span>{label}</span>
    </a>
  );
}
