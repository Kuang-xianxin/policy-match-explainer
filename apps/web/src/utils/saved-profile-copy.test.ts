import { describe, expect, it } from 'vitest';
import { savedProfilesActionHint } from './saved-profile-copy';

describe('saved profile copy', () => {
  it('explains that clicking a saved company starts policy matching', () => {
    expect(savedProfilesActionHint()).toBe('点击已保存企业即可进入政策匹配流程，系统会显示匹配进度和预计耗时。');
  });
});
