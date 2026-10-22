import {
  getMaskedDisplayName,
  isProfileAvailable,
  MASKED_USER_PLACEHOLDER,
  UNKNOWN_USER_PLACEHOLDER
} from './profile-mask.utils';

describe('profile-mask.utils', () => {
  describe('getMaskedDisplayName', () => {
    it('returns real display name when profile is available', () => {
      expect(getMaskedDisplayName({ displayName: 'Satyam Kumar', available: true })).toBe('Satyam Kumar');
    });

    it('returns masked placeholder when profile is unavailable (blocked per ADR 007)', () => {
      expect(getMaskedDisplayName({ displayName: 'Satyam Kumar', available: false })).toBe(MASKED_USER_PLACEHOLDER);
    });

    it('returns masked placeholder when unavailable is false and displayName is null', () => {
      expect(getMaskedDisplayName({ displayName: null, available: false })).toBe(MASKED_USER_PLACEHOLDER);
    });

    it('returns fallback placeholder when displayName is null or empty but available', () => {
      expect(getMaskedDisplayName({ displayName: '', available: true })).toBe(UNKNOWN_USER_PLACEHOLDER);
      expect(getMaskedDisplayName({ displayName: '   ', available: true })).toBe(UNKNOWN_USER_PLACEHOLDER);
      expect(getMaskedDisplayName({ displayName: null, available: true })).toBe(UNKNOWN_USER_PLACEHOLDER);
    });

    it('works when passed a string and an explicit isAvailable boolean', () => {
      expect(getMaskedDisplayName('Satyam', true)).toBe('Satyam');
      expect(getMaskedDisplayName('Satyam', false)).toBe(MASKED_USER_PLACEHOLDER);
      expect(getMaskedDisplayName('', true)).toBe(UNKNOWN_USER_PLACEHOLDER);
    });

    it('handles null/undefined gracefully', () => {
      expect(getMaskedDisplayName(null)).toBe(UNKNOWN_USER_PLACEHOLDER);
      expect(getMaskedDisplayName(undefined)).toBe(UNKNOWN_USER_PLACEHOLDER);
      expect(getMaskedDisplayName(null, false)).toBe(MASKED_USER_PLACEHOLDER);
    });
  });

  describe('isProfileAvailable', () => {
    it('returns true when available is true or omitted', () => {
      expect(isProfileAvailable({ displayName: 'Alice', available: true })).toBe(true);
      expect(isProfileAvailable({ displayName: 'Alice' })).toBe(true);
    });

    it('returns false when available is explicitly false', () => {
      expect(isProfileAvailable({ displayName: 'Alice', available: false })).toBe(false);
      expect(isProfileAvailable({ available: false })).toBe(false);
    });

    it('returns false when profile is null or undefined', () => {
      expect(isProfileAvailable(null)).toBe(false);
      expect(isProfileAvailable(undefined)).toBe(false);
    });
  });
});
