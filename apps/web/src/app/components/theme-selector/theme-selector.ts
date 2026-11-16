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
    { value: 'midnight-indigo', label: 'Midnight Indigo' },
    { value: 'arctic-blue', label: 'Arctic Blue' },
    { value: 'forest-mint', label: 'Forest Mint' },
    { value: 'obsidian-violet', label: 'Obsidian Violet' },
  ];
  protected readonly themes = inject(ThemeService);
}
