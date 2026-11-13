import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ComposerReplyBannerComponent } from './composer-reply-banner.component';

describe('ComposerReplyBannerComponent', () => {
  let component: ComposerReplyBannerComponent;
  let fixture: ComponentFixture<ComposerReplyBannerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ComposerReplyBannerComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ComposerReplyBannerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display sender name and preview content', () => {
    fixture.componentRef.setInput('senderName', 'Satyam');
    fixture.componentRef.setInput('previewContent', 'Hello world, this is a test!');
    fixture.detectChanges();

    const senderEl = fixture.nativeElement.querySelector('.reply-sender-name');
    const previewEl = fixture.nativeElement.querySelector('.reply-preview');

    expect(senderEl.textContent).toContain('Satyam');
    expect(previewEl.textContent).toContain('Hello world, this is a test!');
  });

  it('should emit dismiss when close button clicked', () => {
    let dismissed = false;
    component.dismiss.subscribe(() => (dismissed = true));

    const dismissBtn = fixture.nativeElement.querySelector('.btn-dismiss-reply');
    expect(dismissBtn).not.toBeNull();
    dismissBtn.click();

    expect(dismissed).toBe(true);
  });
});
