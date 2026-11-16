import { Component } from '@angular/core';

@Component({
  selector: 'app-card',
  template: '<ng-content />',
  host: {
    class: 'block min-w-0 rounded-panel border border-border bg-surface p-6',
  },
})
export class Card {}
