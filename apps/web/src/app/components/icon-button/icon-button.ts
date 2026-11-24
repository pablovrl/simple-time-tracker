import { Component, input } from '@angular/core';

@Component({
  selector: 'button[appIconButton]',
  template: '<ng-content />',
  host: {
    type: 'button',
    class:
      'inline-flex size-8 shrink-0 items-center justify-center rounded-full border enabled:cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2',
    '[class]':
      "variant() === 'danger' ? 'text-red-700 enabled:hover:bg-red-50' : 'enabled:hover:bg-gray-100'",
  },
})
export class IconButton {
  readonly variant = input<'default' | 'danger'>('default');
}
