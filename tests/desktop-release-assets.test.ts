import { describe, expect, it } from 'vitest';
import { isDirectCliInvocation } from '../scripts/desktop-release-assets.mjs';

describe('Desktop release asset script', () => {
  it('detects direct CLI invocation from Windows argv paths', () => {
    expect(isDirectCliInvocation(
      'file:///D:/a/AXIS/AXIS/scripts/desktop-release-assets.mjs',
      'D:\\a\\AXIS\\AXIS\\scripts\\desktop-release-assets.mjs'
    )).toBe(true);
  });
});
