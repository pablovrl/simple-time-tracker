import { Component } from '@angular/core';

@Component({
  selector: 'table[appTable]',
  template: '<ng-content />',
  host: {
    class:
      'w-full text-left text-sm [&_thead]:border-b [&_thead]:border-border [&_thead]:text-muted [&_thead_th]:px-4 [&_thead_th]:py-3 [&_thead_th]:font-medium [&_tbody]:divide-y [&_tbody]:divide-border [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-surface-hover [&_tbody_td]:px-4 [&_tbody_td]:py-4 [&_tbody_th]:px-4 [&_tbody_th]:py-4 [&_tbody_th]:font-medium [&_tbody_th]:text-headline',
  },
})
export class Table {}
