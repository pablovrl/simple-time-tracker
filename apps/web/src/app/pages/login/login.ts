import { Component, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  template: '<button type="button" (click)="login()">Continue with Google</button>',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly document = inject(DOCUMENT);

  protected login() {
    this.document.defaultView?.location.assign(this.auth.loginUrl);
  }
}
