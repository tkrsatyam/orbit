import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { GroupComponent } from './group.component';

describe('GroupComponent', () => {
  let fixture: ComponentFixture<GroupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GroupComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (key: string) => (key === 'id' ? 'engineering-team' : null)
              }
            }
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(GroupComponent);
    fixture.detectChanges();
  });

  it('should render group id from route parameters', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.group-header h2')?.textContent).toContain('Group: engineering-team');
  });
});
