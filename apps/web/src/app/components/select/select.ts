import { Component, input, output } from '@angular/core';

export interface SelectOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-select',
  templateUrl: './select.html',
  styleUrl: './select.css',
})
export class Select {
  readonly label = input.required<string>();
  readonly options = input.required<readonly SelectOption[]>();
  readonly value = input('');
  readonly disabled = input(false);
  readonly valueChange = output<string>();
}
