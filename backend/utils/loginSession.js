// Only call after Supabase has authenticated this token.
export function sessionId(token) {
  try { return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).session_id || null; }
  catch { return null; }
}
