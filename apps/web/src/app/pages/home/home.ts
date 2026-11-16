import { Component, inject } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { ThemeSelector } from '../../components/theme-selector/theme-selector';
import { Button } from '../../components/button/button';

@Component({
  selector: 'app-home',
  imports: [ThemeSelector, Button],
  templateUrl: './home.html',
})
export class Home {
  protected readonly auth = inject(AuthService);
}
