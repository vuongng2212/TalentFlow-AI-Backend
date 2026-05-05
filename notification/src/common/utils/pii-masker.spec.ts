import { maskEmail, maskPhone, maskPii } from './pii-masker';

describe('pii-masker', () => {
  it('masks email addresses', () => {
    expect(maskEmail('candidate@example.com')).toBe('ca*******@example.com');
  });

  it('masks phone numbers', () => {
    expect(maskPhone('+84 912 345 678')).toBe('*******5678');
  });

  it('masks PII in log text', () => {
    expect(maskPii('candidate@example.com +84 912 345 678')).toBe(
      'ca*******@example.com *******5678',
    );
  });
});
