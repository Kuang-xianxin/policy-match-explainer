import { describe, expect, it } from 'vitest';
import { shouldShowLoginNav } from './nav-visibility';

describe('navigation visibility', () => {
  it('hides the login navigation entry after the user is authenticated', () => {
    expect(shouldShowLoginNav(false)).toBe(true);
    expect(shouldShowLoginNav(true)).toBe(false);
  });
});
