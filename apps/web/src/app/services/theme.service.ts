import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject, Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark' | 'blush' | 'rose' | 'system';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly window = this.document.defaultView;
  private readonly system = this.window?.matchMedia('(prefers-color-scheme: dark)');
  private readonly preference = signal<Theme>('system');
  readonly theme = this.preference.asReadonly();

  constructor() {
    try {
      this.preference.set(this.normalize(this.window?.localStorage.getItem('theme')));
    } catch {
      // The system preference still works if browser storage is unavailable.
    }
    this.apply();
    const onSystemChange = () => this.apply();
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'theme' || event.key === null) {
        this.preference.set(this.normalize(event.newValue));
        this.apply();
      }
    };
    this.system?.addEventListener('change', onSystemChange);
    this.window?.addEventListener('storage', onStorage);
    inject(DestroyRef).onDestroy(() => {
      this.system?.removeEventListener('change', onSystemChange);
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
    return value === 'light' || value === 'dark' || value === 'blush' || value === 'rose'
      ? value
      : 'system';
  }

  private apply() {
    const theme = this.preference();
    this.document.documentElement.dataset['theme'] =
      theme === 'system' ? (this.system?.matches ? 'dark' : 'light') : theme;
  }
}
