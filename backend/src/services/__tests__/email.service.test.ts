import { renderHtmlTemplate, renderTemplate } from '../email.service';

describe('email template rendering', () => {
  it('escapes variable values in HTML while preserving trusted template markup', () => {
    expect(renderHtmlTemplate('<p>{{value}}</p>', { value: '<img src=x onerror="alert(1)">' }))
      .toBe('<p>&lt;img src=x onerror=&quot;alert(1)&quot;&gt;</p>');
  });

  it('escapes ampersands and apostrophes in rendered HTML values', () => {
    expect(renderHtmlTemplate('<a title="{{value}}">{{value}}</a>', { value: "R&D's" }))
      .toBe('<a title="R&amp;D&#39;s">R&amp;D&#39;s</a>');
  });

  it('keeps plain-text/subject substitutions unescaped', () => {
    expect(renderTemplate('Hello {{name}}', { name: 'A & B' })).toBe('Hello A & B');
  });

  it('renders missing variables as empty strings', () => {
    expect(renderHtmlTemplate('<p>{{missing}}</p>', {})).toBe('<p></p>');
  });
});
