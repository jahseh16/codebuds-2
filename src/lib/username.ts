/**
 * Username validation, normalization, and display utility.
 * Shared across all frontend components.
 */

export const USERNAME_REGEX = /^[a-z0-9._]{3,20}$/

export function normalizeUsername(value: string): string {
  return String(value ?? '').trim().toLowerCase()
}

/**
 * Validates a username and returns an error message or null if valid.
 * Use for real-time validation on input, blur, and before submit.
 */
export function validateUsername(value: string): string | null {
  const username = normalizeUsername(value)

  if (!username) {
    return 'Username is required.'
  }

  if (username.includes('@')) {
    return 'Username cannot contain @ or be an email address.'
  }

  if (username.length < 3 || username.length > 20) {
    return 'Username must be between 3 and 20 characters.'
  }

  if (!USERNAME_REGEX.test(username)) {
    return 'Use only letters, numbers, periods, and underscores.'
  }

  return null
}

/**
 * Safely display a username for rendering in the UI.
 * Handles legacy usernames that may contain emails, @, or invalid characters.
 * Always use this instead of directly interpolating profile.username.
 *
 * Examples:
 *   displayUsername('pepe@gmail.com') → 'pepe'
 *   displayUsername('PePe_123')       → 'pepe_123'
 *   displayUsername('pe')             → 'pe' (too short but we show what's there)
 *   displayUsername(null)             → 'user'
 */
export function displayUsername(value?: string | null): string {
  const raw = String(value ?? '').trim()
  const beforeAt = raw.split('@')[0]
  const cleaned = beforeAt
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, '')
    .slice(0, 20)

  return cleaned || 'user'
}
