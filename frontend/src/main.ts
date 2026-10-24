import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

if (typeof window !== 'undefined' && typeof (window as unknown as { global: unknown }).global === 'undefined') {
  (window as unknown as { global: unknown }).global = window;
}

bootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));
