// Utility for decoding JWTs and extracting user info

export interface DecodedJWT {
  email: string | null;
  role: 'Admin' | 'Manager' | 'Clerk' | null;
  userId: string | null;
  exp: number | null;
  rawPayload: any;
}

// Common claim URIs
const EMAIL_CLAIMS = [
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
  'email',
  'sub',
];
const ROLE_CLAIMS = [
  'http://schemas.microsoft.com/ws/2008/06/identity/claims/role',
  'role',
];
const USERID_CLAIMS = [
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier',
  'userId',
  'sub',
];

export function decodeJWT(token: string): DecodedJWT | null {
  try {
    const payloadBase64 = token.split('.')[1];
    if (!payloadBase64) return null;
    const payloadJson = atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(payloadJson);

    // Extract email
    let email: string | null = null;
    for (const claim of EMAIL_CLAIMS) {
      if (payload[claim]) {
        email = payload[claim];
        break;
      }
    }

    // Extract role
    let role: 'Admin' | 'Manager' | 'Clerk' | null = null;
    for (const claim of ROLE_CLAIMS) {
      if (payload[claim]) {
        if (['Admin', 'Manager', 'Clerk'].includes(payload[claim])) {
          role = payload[claim];
          break;
        }
      }
    }

    // Extract userId
    let userId: string | null = null;
    for (const claim of USERID_CLAIMS) {
      if (payload[claim]) {
        userId = payload[claim];
        break;
      }
    }

    // Expiry
    const exp = typeof payload.exp === 'number' ? payload.exp : null;

    return { email, role, userId, exp, rawPayload: payload };
  } catch {
    return null;
  }
} 