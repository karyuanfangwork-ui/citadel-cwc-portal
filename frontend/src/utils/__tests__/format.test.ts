import { describe, expect, it } from 'vitest';
import { stripHtml } from '../format';

describe('stripHtml', () => {
  it('removes HTML that was stored with encoded paragraph tags', () => {
    expect(stripHtml('&lt;p&gt;need help on the laptop&lt;&#x2F;p&gt;'))
      .toBe('need help on the laptop');
  });

  it('decodes regular HTML entities in plain text', () => {
    expect(stripHtml('Printer &amp; network issue')).toBe('Printer & network issue');
  });
});