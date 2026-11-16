import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.html',
})
export class Login {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected retry() {
    this.auth.loadUser().subscribe(() => {
      if (this.auth.user()) void this.router.navigateByUrl('/home');
    });
  }
}
