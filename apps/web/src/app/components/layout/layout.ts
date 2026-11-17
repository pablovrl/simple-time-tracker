import { Component, inject } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { TimeTracker } from '../time-tracker/time-tracker';
import { RouterLink, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-layout',
  imports: [TimeTracker, RouterLink, RouterOutlet],
  templateUrl: './layout.html',
})
export class Layout {
  private readonly auth = inject(AuthService);

  protected logout(event: MouseEvent) {
    event.preventDefault();
    this.auth.logout();
  }
}
