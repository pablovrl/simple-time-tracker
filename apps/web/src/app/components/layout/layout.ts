import { Component, inject } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { Sidebar } from '../sidebar/sidebar';
import { Topbar } from '../topbar/topbar';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, Sidebar, Topbar],
  templateUrl: './layout.html',
})
export class Layout {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly pageTitle = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(null),
      map(() => {
        let route = this.route.snapshot;
        while (route.firstChild) route = route.firstChild;
        return route.title ?? '';
      }),
    ),
    { initialValue: '' },
  );
}
