import { toCsv } from '../utils/csv';

describe('toCsv (RFC-4180)', () => {
  it('encodes simple rows', () => {
    const result = toCsv(
      [{ name: 'Alice', age: 30 }, { name: 'Bob', age: 25 }],
      ['name', 'age'],
    );
    expect(result).toBe('name,age\r\nAlice,30\r\nBob,25');
  });

  it('quotes fields containing commas', () => {
    const result = toCsv(
      [{ name: 'Smith, Jr.', city: 'NYC' }],
      ['name', 'city'],
    );
    expect(result).toBe('name,city\r\n"Smith, Jr.",NYC');
  });

  it('quotes fields containing double quotes by doubling them', () => {
    const result = toCsv(
      [{ desc: 'He said "hello"', value: 1 }],
      ['desc', 'value'],
    );
    expect(result).toBe('desc,value\r\n"He said ""hello""",1');
  });

  it('quotes fields containing newlines', () => {
    const result = toCsv(
      [{ note: 'line1\nline2', id: 5 }],
      ['note', 'id'],
    );
    expect(result).toBe('note,id\r\n"line1\nline2",5');
  });

  it('handles null and undefined as empty string', () => {
    const result = toCsv(
      [{ a: null as any, b: undefined as any, c: 'ok' }],
      ['a', 'b', 'c'],
    );
    expect(result).toBe('a,b,c\r\n,,ok');
  });

  it('converts numbers and booleans to strings', () => {
    const result = toCsv(
      [{ n: 42, b: true, s: 'text' }],
      ['n', 'b', 's'],
    );
    expect(result).toBe('n,b,s\r\n42,true,text');
  });

  it('uses custom column labels', () => {
    const result = toCsv(
      [{ name: 'Alice' }],
      [{ key: 'name', label: 'Full Name' }],
    );
    expect(result).toBe('Full Name\r\nAlice');
  });

  it('handles empty rows array', () => {
    const result = toCsv([], ['name', 'age']);
    expect(result).toBe('name,age');
  });
});