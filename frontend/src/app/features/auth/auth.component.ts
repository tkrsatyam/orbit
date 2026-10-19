import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="auth-page">
      <h1>{{ isRegister() ? 'Create an Account' : 'Welcome to Orbit' }}</h1>
      <p>{{ isRegister() ? 'Sign up to start chatting.' : 'Sign in to access your conversations.' }}</p>
      @if (isRegister()) {
        <p>Already have an account? <a routerLink="/login">Sign In</a></p>
      } @else {
        <p>Don't have an account? <a routerLink="/register">Register</a></p>
      }
    </div>
  `,
  styles: [`
    .auth-page {
      padding: 2rem;
      text-align: center;
    }
  `]
})
export class AuthComponent {
  private readonly route = inject(ActivatedRoute);

  isRegister(): boolean {
    return this.route.snapshot.data['mode'] === 'register';
  }
}
