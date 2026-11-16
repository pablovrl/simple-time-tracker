import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { Button } from '../../components/button/button';

@Component({
  selector: 'app-login',
  imports: [Button],
  templateUrl: './login.html',
})
export class Login {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected retry() {
    this.auth.loadUser().subscribe(() => {
      if (this.auth.user()) void this.router.navigateByUrl('/dashboard');
    });
  }
}
