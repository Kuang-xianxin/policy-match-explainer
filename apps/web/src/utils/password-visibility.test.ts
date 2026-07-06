import { describe, expect, it } from 'vitest';
import { passwordInputType, passwordToggleLabel } from './password-visibility';

describe('password visibility helpers', () => {
  it('uses password input type while hidden and text input type while visible', () => {
    expect(passwordInputType(false)).toBe('password');
    expect(passwordInputType(true)).toBe('text');
  });

  it('uses clear accessible labels for the visibility toggle', () => {
    expect(passwordToggleLabel(false)).toBe('显示密码');
    expect(passwordToggleLabel(true)).toBe('隐藏密码');
  });
});
