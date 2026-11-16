import { Component, inject, input } from '@angular/core';
import { LucideLogOut } from '@lucide/angular';
import { Button } from '../button/button';
import { AuthService } from '../../services/auth.service';
import { TimeTracker } from '../time-tracker/time-tracker';

@Component({
  selector: 'app-topbar',
  imports: [Button, LucideLogOut, TimeTracker],
  templateUrl: './topbar.html',
  host: { class: 'block h-24' },
})
export class Topbar {
  protected readonly auth = inject(AuthService);
  readonly title = input('');
}
