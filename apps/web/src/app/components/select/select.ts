import { Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { LucideChevronDown } from '@lucide/angular';

export interface SelectItem {
  value: string;
  label: string;
}

@Component({
  selector: 'app-select',
  imports: [LucideChevronDown],
  templateUrl: './select.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => Select),
      multi: true,
    },
  ],
  host: {
    class:
      'relative block min-w-0 [&_select]:h-11 [&_select]:w-full [&_select]:min-w-0 [&_select]:appearance-none [&_select]:border [&_select]:bg-white [&_select]:py-2 [&_select]:pr-10 [&_select]:pl-3 [&_select:disabled]:cursor-not-allowed [&_select:disabled]:opacity-50',
  },
})
export class Select implements ControlValueAccessor {
  readonly items = input.required<readonly SelectItem[]>();
  readonly required = input(false);
  readonly ariaLabel = input<string>();
  protected readonly value = signal('');
  protected readonly disabled = signal(false);
  private onChange: (value: string) => void = () => {};
  protected onTouched: () => void = () => {};

  writeValue(value: string | null) {
    this.value.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void) {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void) {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean) {
    this.disabled.set(disabled);
  }

  protected select(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    this.value.set(value);
    this.onChange(value);
  }
}
