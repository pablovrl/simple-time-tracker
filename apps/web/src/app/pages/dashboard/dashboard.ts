import { Component, inject } from '@angular/core';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.html',
})
export class Dashboard {
  private readonly auth = inject(AuthService);

  protected logout(event: MouseEvent) {
    event.preventDefault();
    this.auth.logout();
  }
}
