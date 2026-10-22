/**
 * Utility functions for masking user display names and handling profile visibility
 * per ADR 007 (Blocking Behavior: Visibility, Messaging, and Presence).
 */

export const MASKED_USER_PLACEHOLDER = 'Orbit User';
export const UNKNOWN_USER_PLACEHOLDER = 'Unknown User';

export interface MaskableProfile {
  displayName?: string | null;
  available?: boolean | null;
}

/**
 * Returns a display name masked per ADR 007 if the profile is unavailable (e.g. requester is blocked),
 * or falls back to 'Unknown User' if display name is blank/absent.
 */
export function getMaskedDisplayName(
  profileOrName: MaskableProfile | string | null | undefined,
  isAvailable?: boolean | null
): string {
  if (profileOrName === null || profileOrName === undefined) {
    if (isAvailable === false) {
      return MASKED_USER_PLACEHOLDER;
    }
    return UNKNOWN_USER_PLACEHOLDER;
  }

  // If passed an object conforming to MaskableProfile
  if (typeof profileOrName === 'object') {
    if (profileOrName.available === false) {
      return MASKED_USER_PLACEHOLDER;
    }
    const name = profileOrName.displayName?.trim();
    return name && name.length > 0 ? name : UNKNOWN_USER_PLACEHOLDER;
  }

  // If passed string directly with explicit isAvailable flag
  if (isAvailable === false) {
    return MASKED_USER_PLACEHOLDER;
  }

  const name = profileOrName.trim();
  return name.length > 0 ? name : UNKNOWN_USER_PLACEHOLDER;
}

/**
 * Checks if a profile object is marked as available per ADR 007.
 * Default is true unless explicitly false.
 */
export function isProfileAvailable(profile: MaskableProfile | null | undefined): boolean {
  if (!profile) return false;
  return profile.available !== false;
}
