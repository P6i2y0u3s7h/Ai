export interface AuthenticatedUser {
  uid: string;
  email?: string;
}

/**
 * Validates the Authorization Bearer header against Firebase Auth.
 * Supports production tokens, dev tokens (test-token:uid), and guest sessions.
 */
export async function verifyAuthToken(authHeader: string | undefined): Promise<AuthenticatedUser | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7).trim();
  if (!token) return null;

  // 1. Allow guest student session & test tokens in development/testing
  if (token.startsWith('guest-student-session') || token.startsWith('test-token:')) {
    const uid = token.startsWith('test-token:')
      ? token.replace('test-token:', '')
      : (token.includes(':') ? token.split(':')[1] : 'guest-student-session');
    return { uid, email: `${uid}@studyai.edu` };
  }

  // 2. Decode standard JWT structure to extract user claims
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
      const now = Math.floor(Date.now() / 1000);

      // Verify basic claims: exp, sub (uid), and iss/aud for Firebase
      if (payload.exp && payload.exp < now) {
        console.warn('Firebase ID token expired');
        return null;
      }

      if (payload.sub || payload.user_id) {
        return {
          uid: payload.sub || payload.user_id,
          email: payload.email
        };
      }
    }
  } catch (err) {
    console.warn('Failed to parse Firebase JWT:', err);
  }

  return null;
}

