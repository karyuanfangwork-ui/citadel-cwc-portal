import { parseOptionalLeadEstimatedValue } from '../crm-import-export.service';

describe('parseOptionalLeadEstimatedValue', () => {
  it.each([
    ['missing', undefined, null],
    ['null', null, null],
    ['empty string', '', null],
    ['whitespace', '  ', null],
    ['zero', 0, 0],
    ['positive numeric value', 1250.5, 1250.5],
    ['positive numeric string', '1250.5', 1250.5],
  ])('preserves %s distinctly', (_label, input, expected) => {
    expect(parseOptionalLeadEstimatedValue(input)).toBe(expected);
  });
});
