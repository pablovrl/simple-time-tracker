import { AfterViewInit, Component, ElementRef, input, output, viewChild } from '@angular/core';
import { LucideX } from '@lucide/angular';

@Component({
  selector: 'app-modal',
  imports: [LucideX],
  templateUrl: './modal.html',
  styleUrl: './modal.css',
})
export class Modal implements AfterViewInit {
  readonly label = input('modal');
  readonly dismissible = input(true);
  readonly closed = output<void>();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private closing = false;

  ngAfterViewInit() {
    this.dialog().nativeElement.showModal();
  }

  async close() {
    if (this.closing || !this.dismissible()) return;
    this.closing = true;
    const dialog = this.dialog().nativeElement;
    dialog.classList.add('closing');
    await Promise.allSettled(
      dialog.getAnimations({ subtree: true }).map((animation) => animation.finished),
    );
    if (dialog.isConnected) dialog.close();
  }

  protected onCancel(event: Event) {
    event.preventDefault();
    void this.close();
  }

  protected onBackdropClick(event: MouseEvent) {
    const dialog = this.dialog().nativeElement;
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    ) {
      this.close();
    }
  }
}
