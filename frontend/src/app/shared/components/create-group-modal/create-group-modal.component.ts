import { Component, EventEmitter, inject, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { GroupResponse, GroupService, GroupVisibility } from '../../../core/services/group.service';

@Component({
  selector: 'app-create-group-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './create-group-modal.component.html',
  styleUrl: './create-group-modal.component.scss'
})
export class CreateGroupModalComponent {
  private readonly fb = inject(FormBuilder);
  private readonly groupService = inject(GroupService);

  @Input() isOpen = false;
  @Output() closeModal = new EventEmitter<void>();
  @Output() groupCreated = new EventEmitter<GroupResponse>();

  readonly groupForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
    topicTag: ['', [Validators.required, Validators.maxLength(50)]],
    description: ['', [Validators.maxLength(500)]],
    visibility: ['PUBLIC', [Validators.required]]
  });

  readonly isSubmitting = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  selectedVisibility(): GroupVisibility {
    return this.groupForm.get('visibility')?.value as GroupVisibility;
  }

  setVisibility(visibility: GroupVisibility): void {
    this.groupForm.patchValue({ visibility });
  }

  handleClose(): void {
    this.groupForm.reset({ visibility: 'PUBLIC' });
    this.errorMessage.set(null);
    this.closeModal.emit();
  }

  onSubmit(): void {
    if (this.groupForm.invalid || this.isSubmitting()) {
      this.groupForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const formVal = this.groupForm.value;
    let topic = formVal.topicTag ? formVal.topicTag.trim() : '';
    if (topic && !topic.startsWith('#')) {
      topic = '#' + topic;
    }

    this.groupService.createGroup({
      name: formVal.name.trim(),
      topicTag: topic,
      description: formVal.description ? formVal.description.trim() : null,
      visibility: formVal.visibility
    }).subscribe({
      next: (createdGroup: GroupResponse) => {
        this.isSubmitting.set(false);
        this.groupCreated.emit(createdGroup);
        this.handleClose();
      },
      error: (err: { error?: { message?: string } }) => {
        this.isSubmitting.set(false);
        const msg = err.error?.message || 'Failed to create group. Please try again.';
        this.errorMessage.set(msg);
      }
    });
  }
}
