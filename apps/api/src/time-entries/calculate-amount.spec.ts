import { calculateAmount } from './calculate-amount.js';

describe('calculateAmount', () => {
  it.each([
    ['18000.000000', 'CLP', 3600000, '18000'],
    ['25.500000', 'USD', 3600000, '25.50'],
    ['25.500000', 'EUR', 1800000, '12.75'],
    ['10.000000', 'USD', 1800, '0.01'],
    ['18000.000000', 'CLP', 100, '1'],
    ['1.123456', 'USD', 3600000, '1.12'],
    ['999999999999.999999', 'USD', 3600000, '1000000000000.00'],
    ['0.000000', 'USD', 3600000, '0.00'],
    ['25.500000', 'USD', 0, '0.00'],
  ])(
    'calculates %s %s for %i ms as %s',
    (rate, currency, duration, expected) => {
      expect(calculateAmount(rate, currency, duration)).toBe(expected);
    },
  );

  it('rejects negative durations and rates', () => {
    expect(() => calculateAmount('10', 'USD', -1)).toThrow();
    expect(() => calculateAmount('-10', 'USD', 1000)).toThrow();
  });
});
