/**
 * Username validation and normalization utility.
 * Shared across all backend endpoints that accept usernames.
 */

export const USERNAME_REGEX = /^[a-z0-9._]{3,20}$/

export function normalizeUsername(value) {
  return String(value ?? '').trim().toLowerCase()
}

export function validateUsername(value) {
  const username = normalizeUsername(value)

  if (!username) {
    return { valid: false, username, error: 'Username is required.' }
  }

  if (username.includes('@')) {
    return {
      valid: false,
      username,
      error: 'Username cannot contain @ or be an email address.',
    }
  }

  if (username.length < 3 || username.length > 20) {
    return {
      valid: false,
      username,
      error: 'Username must be between 3 and 20 characters.',
    }
  }

  if (!USERNAME_REGEX.test(username)) {
    return {
      valid: false,
      username,
      error: 'Use only letters, numbers, periods, and underscores.',
    }
  }

  return { valid: true, username, error: null }
}
