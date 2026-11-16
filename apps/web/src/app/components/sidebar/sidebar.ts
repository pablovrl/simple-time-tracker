import { Component, inject } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { Button } from '../button/button';
import { ThemeSelector } from '../theme-selector/theme-selector';

@Component({
  selector: 'app-sidebar',
  imports: [Button, ThemeSelector],
  templateUrl: './sidebar.html',
  host: { class: 'block md:w-72 md:shrink-0' },
})
export class Sidebar {
  protected readonly auth = inject(AuthService);
}
