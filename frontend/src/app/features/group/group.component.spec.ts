import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { GroupComponent } from './group.component';

describe('GroupComponent', () => {
  let fixture: ComponentFixture<GroupComponent>;

  const setupComponent = async (paramId: string | null = 'engineering-team') => {
    await TestBed.configureTestingModule({
      imports: [GroupComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (key: string) => (key === 'id' ? paramId : null)
              }
            }
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(GroupComponent);
    fixture.detectChanges();
  };

  it('should create group component successfully', async () => {
    await setupComponent();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render group id from route parameters', async () => {
    await setupComponent('engineering-team');
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.group-header h2')?.textContent).toContain('Group: engineering-team');
  });

  it('should render subtitle and back link to conversations', async () => {
    await setupComponent();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.group-subtitle')?.textContent).toContain(
      'This is a protected group view. Only authenticated users can access this page.'
    );
    const backLink = compiled.querySelector('.back-link') as HTMLAnchorElement;
    expect(backLink).not.toBeNull();
    expect(backLink.textContent).toContain('Back to conversations');
  });

  it('should return empty string when route id parameter is missing', async () => {
    await setupComponent(null);
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.group-header h2')?.textContent?.trim()).toBe('Group:');
  });
});
