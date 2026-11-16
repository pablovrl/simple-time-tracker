import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LucideLayoutDashboard, LucideUsers } from '@lucide/angular';
import { ThemeSelector } from '../theme-selector/theme-selector';

@Component({
  selector: 'app-sidebar',
  imports: [ThemeSelector, RouterLink, RouterLinkActive, LucideLayoutDashboard, LucideUsers],
  templateUrl: './sidebar.html',
  host: { class: 'block md:w-60 md:shrink-0' },
})
export class Sidebar {}
