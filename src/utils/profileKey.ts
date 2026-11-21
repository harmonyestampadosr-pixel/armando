const PROFILE_KEY_STORAGE = 'dtqd_profile_key';
const PROFILE_NAME_STORAGE = 'dtqd_profile_name';

export function getOrCreateProfileKey(): string {
  if (typeof window === 'undefined') return 'server-guest';
  try {
    const existing = localStorage.getItem(PROFILE_KEY_STORAGE);
    if (existing && existing.trim().length >= 8) {
      return existing.trim();
    }
    const generated = `prof-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 10)}`;
    localStorage.setItem(PROFILE_KEY_STORAGE, generated);
    return generated;
  } catch {
    return `prof-temp-${Date.now().toString(36)}`;
  }
}

export function getSavedProfileName(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(PROFILE_NAME_STORAGE) || '';
  } catch {
    return '';
  }
}

export function saveProfileName(name: string): void {
  if (typeof window === 'undefined') return;
  try {
    const clean = name.trim();
    if (clean) {
      localStorage.setItem(PROFILE_NAME_STORAGE, clean);
    }
  } catch {
    // ignore
  }
}
