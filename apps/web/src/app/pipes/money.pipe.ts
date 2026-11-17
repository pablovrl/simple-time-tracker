import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  transform(value: string | null, currency: string): string {
    if (value === null) return '—';
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
    }).format(value as unknown as number);
  }
}
