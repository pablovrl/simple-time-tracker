import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { IconButton } from './icon-button';

@Component({
  imports: [IconButton],
  template: `
    <button appIconButton aria-label="edit" (click)="clicks = clicks + 1">
      <span>icon</span>
    </button>
    <button
      appIconButton
      variant="danger"
      aria-label="delete"
      [disabled]="true"
      (click)="clicks = clicks + 1"
    >
      delete icon
    </button>
  `,
})
class TestHost {
  clicks = 0;
}

describe('IconButton', () => {
  it('renders compact native buttons with projected content and variants', () => {
    const fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();
    const [edit, remove] = fixture.nativeElement.querySelectorAll(
      'button',
    ) as NodeListOf<HTMLButtonElement>;
    expect(edit.type).toBe('button');
    expect(edit.classList.contains('size-8')).toBe(true);
    expect(edit.classList.contains('rounded-full')).toBe(true);
    expect(edit.querySelector('span')?.textContent).toBe('icon');
    expect(edit.getAttribute('aria-label')).toBe('edit');
    expect(remove.classList.contains('size-8')).toBe(true);
    expect(remove.classList.contains('text-red-700')).toBe(true);
    edit.click();
    remove.click();
    expect(fixture.componentInstance.clicks).toBe(1);
  });
});
