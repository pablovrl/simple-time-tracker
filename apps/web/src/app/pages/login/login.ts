import { Component, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { Card } from '../../components/card/card';

@Component({
  selector: 'app-login',
  imports: [Card],
  templateUrl: './login.html',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly document = inject(DOCUMENT);

  protected login() {
    this.document.defaultView?.location.assign(this.auth.loginUrl);
  }
}
