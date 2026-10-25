import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ComposerEditingBannerComponent } from './composer-editing-banner.component';

describe('ComposerEditingBannerComponent', () => {
  let component: ComposerEditingBannerComponent;
  let fixture: ComponentFixture<ComposerEditingBannerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ComposerEditingBannerComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ComposerEditingBannerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render preview content', () => {
    fixture.componentRef.setInput('previewContent', 'Test message preview');
    fixture.detectChanges();

    const preview = fixture.nativeElement.querySelector('[data-testid="editing-preview"]');
    expect(preview?.textContent).toBe('Test message preview');
  });

  it('should emit cancel when cancel button clicked', () => {
    let cancelled = false;
    component.cancel.subscribe(() => (cancelled = true));

    const cancelBtn = fixture.nativeElement.querySelector('[data-testid="cancel-edit-btn"]');
    cancelBtn.click();

    expect(cancelled).toBe(true);
  });
});
