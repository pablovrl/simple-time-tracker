import { HttpErrorResponse } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { LucidePlus } from '@lucide/angular';
import { Modal } from '../../components/modal/modal';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Button } from '../../components/button/button';
import { Card } from '../../components/card/card';
import { Select } from '../../components/select/select';
import { Project, ProjectsService } from '../../services/projects.service';

@Component({
  selector: 'app-projects',
  imports: [Button, Card, Select, ReactiveFormsModule, LucidePlus, Modal, DatePipe],
  templateUrl: './projects.html',
})
export class Projects implements OnInit {
  private readonly projectsService = inject(ProjectsService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly builder = inject(FormBuilder);
  protected readonly projects = signal<Project[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly showForm = signal(false);
  protected readonly listError = signal<string | null>(null);
  protected readonly formError = signal<string | null>(null);
  protected readonly page = signal(1);
  protected readonly hasMore = signal(false);
  protected readonly currencies = ['USD', 'CLP', 'EUR'].map((currency) => ({
    value: currency,
    label: currency,
  }));
  protected readonly form = this.builder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120), Validators.pattern(/\S/)]],
    description: ['', Validators.maxLength(10000)],
    hourlyRate: ['', [Validators.required, Validators.pattern(/^(0|[1-9]\d{0,11})(\.\d{1,6})?$/)]],
    currency: ['USD', Validators.required],
  });

  ngOnInit() {
    this.load();
  }

  protected formatRate(rate: string, currency: string) {
    const formatter = new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency,
      currencyDisplay: 'code',
    });
    // Modern Intl accepts decimal strings without converting them to Number.
    return formatter.formatToParts(rate as unknown as number)
      .filter((part) => part.type !== 'currency' && part.type !== 'literal')
      .map((part) => part.value)
      .join('');
  }

  protected load(page = this.page()) {
    this.loading.set(true);
    this.listError.set(null);
    this.projectsService
      .list(page)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.projects.set(result.projects);
          this.page.set(result.pagination.page);
          this.hasMore.set(result.pagination.hasMore);
          this.loading.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.loading.set(false);
          if (!this.redirectIfUnauthorized(error)) {
            this.listError.set('Unable to load projects. Please try again.');
          }
        },
      });
  }

  protected openForm() {
    this.formError.set(null);
    this.showForm.set(true);
  }

  protected cancel() {
    this.showForm.set(false);
    this.formError.set(null);
    this.form.reset();
  }

  protected create() {
    if (this.saving()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const input = this.form.getRawValue();
    this.saving.set(true);
    this.formError.set(null);
    this.projectsService
      .create({
        ...input,
        name: input.name.trim(),
        description: input.description.trim(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.cancel();
          this.load(1);
        },
        error: (error: HttpErrorResponse) => {
          this.saving.set(false);
          if (this.redirectIfUnauthorized(error)) return;
          const message = error.status === 400 ? error.error?.message : null;
          this.formError.set(
            Array.isArray(message)
              ? message.join('. ')
              : typeof message === 'string'
                ? message
                : 'Unable to create the project. Please try again.',
          );
        },
      });
  }

  private redirectIfUnauthorized(error: HttpErrorResponse) {
    if (error.status !== 401) return false;
    void this.router.navigateByUrl('/login');
    return true;
  }
}
