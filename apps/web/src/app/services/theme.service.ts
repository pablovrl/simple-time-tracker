import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject, Injectable, signal } from '@angular/core';

export type Theme = 'midnight-indigo' | 'arctic-blue' | 'forest-mint' | 'obsidian-violet';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly window = this.document.defaultView;
  private readonly preference = signal<Theme>('arctic-blue');
  readonly theme = this.preference.asReadonly();

  constructor() {
    try {
      this.preference.set(this.normalize(this.window?.localStorage.getItem('theme')));
    } catch {
      // The default palette remains available without browser storage.
    }
    this.apply();
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'theme' || event.key === null) {
        this.preference.set(this.normalize(event.newValue));
        this.apply();
      }
    };
    this.window?.addEventListener('storage', onStorage);
    inject(DestroyRef).onDestroy(() => {
      this.window?.removeEventListener('storage', onStorage);
    });
  }

  setTheme(value: string) {
    const theme = this.normalize(value);
    this.preference.set(theme);
    try {
      this.window?.localStorage.setItem('theme', theme);
    } catch {
      // Theme changes remain usable for the current visit.
    }
    this.apply();
  }

  private normalize(value: string | null | undefined): Theme {
    if (
      value === 'midnight-indigo' ||
      value === 'arctic-blue' ||
      value === 'forest-mint' ||
      value === 'obsidian-violet'
    )
      return value;
    if (value === 'dark') return 'midnight-indigo';
    if (value === 'system' && this.window?.matchMedia('(prefers-color-scheme: dark)').matches)
      return 'midnight-indigo';
    return 'arctic-blue';
  }

  private apply() {
    this.document.documentElement.dataset['theme'] = this.preference();
  }
}
