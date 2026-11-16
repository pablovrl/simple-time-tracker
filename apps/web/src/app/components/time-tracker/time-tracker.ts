import { Component } from '@angular/core';
import { LucidePlay } from '@lucide/angular';
import { Button } from '../button/button';
import { Card } from '../card/card';

@Component({
  selector: 'app-time-tracker',
  imports: [Button, LucidePlay, Card],
  templateUrl: './time-tracker.html',
})
export class TimeTracker {}
