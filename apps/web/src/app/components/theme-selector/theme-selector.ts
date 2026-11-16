import { Component, inject } from '@angular/core';
import { ThemeService } from '../../services/theme.service';
import { Select, SelectOption } from '../select/select';

@Component({
  selector: 'app-theme-selector',
  imports: [Select],
  templateUrl: './theme-selector.html',
})
export class ThemeSelector {
  protected readonly options: readonly SelectOption[] = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'blush', label: 'Blush' },
    { value: 'rose', label: 'Rose' },
    { value: 'system', label: 'System' },
  ];
  protected readonly themes = inject(ThemeService);
}
