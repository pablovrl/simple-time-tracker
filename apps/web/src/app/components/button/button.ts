import { Component } from '@angular/core';

@Component({
  selector: 'button[appButton], a[appButton]',
  template: '<ng-content />',
  host: {
    class:
      'inline-block cursor-pointer rounded border border-transparent bg-button px-4 py-2.5 text-button-text no-underline enabled:hover:bg-button-hover enabled:active:bg-button-active focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60 [&:not(button)]:hover:bg-button-hover [&:not(button)]:active:bg-button-active',
  },
})
export class Button {}
