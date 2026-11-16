import { Component, effect, ElementRef, input, model, viewChild } from '@angular/core';
import { LucideX } from '@lucide/angular';

@Component({
  selector: 'app-modal',
  imports: [LucideX],
  templateUrl: './modal.html',
})
export class Modal {
  readonly title = input.required<string>();
  readonly open = model(false);
  readonly dismissible = input(true);
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const dialog = this.dialog()?.nativeElement;
      if (!dialog) return;
      if (this.open() && !dialog.open) {
        dialog.showModal();
      } else if (!this.open() && dialog.open) {
        dialog.close();
      }
    });
  }

  protected dismiss() {
    if (this.dismissible()) this.open.set(false);
  }

  protected onCancel(event: Event) {
    event.preventDefault();
    this.dismiss();
  }

  protected onBackdropClick(event: MouseEvent) {
    const dialog = this.dialog()?.nativeElement;
    if (!dialog || event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    ) {
      this.dismiss();
    }
  }
}
