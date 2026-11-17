import { Component, inject } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { TimeTracker } from '../../components/time-tracker/time-tracker';

@Component({
  selector: 'app-home',
  imports: [TimeTracker],
  templateUrl: './home.html',
})
export class Home {
  private readonly auth = inject(AuthService);

  protected logout(event: MouseEvent) {
    event.preventDefault();
    this.auth.logout();
  }
}
