import { Component, inject } from '@angular/core';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.html',
})
export class Home {
  protected readonly auth = inject(AuthService);
}
