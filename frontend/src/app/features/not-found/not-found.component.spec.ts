import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NotFoundComponent } from './not-found.component';

describe('NotFoundComponent', () => {
  let fixture: ComponentFixture<NotFoundComponent>;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [NotFoundComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(NotFoundComponent);
    fixture.detectChanges();
  });

  it('should create not-found component successfully', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render 404 header, subtitle, and informative description', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('404');
    expect(compiled.querySelector('h2')?.textContent).toContain('Page Not Found');
    expect(compiled.querySelector('.not-found-text')?.textContent).toContain(
      'The page you are looking for does not exist or has been moved.'
    );
  });

  it('should render return to home navigation link', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const link = compiled.querySelector('.return-home-link') as HTMLAnchorElement;
    expect(link).not.toBeNull();
    expect(link.textContent?.trim()).toBe('Return to Home');
  });
});
