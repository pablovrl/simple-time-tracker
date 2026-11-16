import { Component } from '@angular/core';

@Component({
  selector: 'button[appButton], a[appButton]',
  template: '<ng-content />',
  host: {
    class:
      'inline-block cursor-pointer rounded border border-border bg-button px-4 py-2.5 text-button-text no-underline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-60',
  },
})
export class Button {}
