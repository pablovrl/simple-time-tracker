import { Component } from '@angular/core';

@Component({
  selector: 'app-card',
  template: '<ng-content />',
  host: {
    class: 'block min-w-0 rounded-panel bg-surface p-6 shadow-sm',
  },
})
export class Card {}
