import { Component } from '@angular/core';

@Component({
  selector: 'input[appInput]',
  template: '',
  host: {
    class:
      'h-11 min-w-0 border px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50',
  },
})
export class Input {}
