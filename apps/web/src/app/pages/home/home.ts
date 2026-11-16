import { Component, inject } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { Sidebar } from '../../components/sidebar/sidebar';

@Component({
  selector: 'app-home',
  imports: [Sidebar],
  templateUrl: './home.html',
})
export class Home {
  protected readonly auth = inject(AuthService);
}
