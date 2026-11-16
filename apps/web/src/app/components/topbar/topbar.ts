import { Component, inject, input } from '@angular/core';
import { LucideLogOut } from '@lucide/angular';
import { Button } from '../button/button';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-topbar',
  imports: [Button, LucideLogOut],
  templateUrl: './topbar.html',
  host: { class: 'block h-24' },
})
export class Topbar {
  protected readonly auth = inject(AuthService);
  readonly title = input('');
}
