import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TeacherProfile from '../../pages/teacher/TeacherProfile';

const uploadAvatar = vi.fn();
const save = vi.fn();
const updateTeacher = vi.fn();
let mockSchedule: Array<{
  id: string;
  day: number;
  startTime: string;
  endTime: string;
  schoolName: string;
  className: string;
  subject: string;
}> = [];
vi.mock('../../services/api', () => ({
  teacherProfileService: {
    uploadAvatar: (...args: unknown[]) => uploadAvatar(...args),
    save: (...args: unknown[]) => save(...args),
  },
}));
vi.mock('../../contexts/TeacherContext', () => ({
  useTeacher: () => ({
    teacher: {
      id: 'teacher-1',
      name: 'دبیر نمونه',
      email: 'teacher@example.com',
      schoolName: 'مدرسه نمونه',
      subject: 'ریاضی',
      bio: '',
      avatarUrl: '',
      schools: [],
      schedule: mockSchedule,
    },
    updateTeacher,
  }),
}));
vi.mock('../../pages/teacher/Students', () => ({ default: () => <div>Students</div> }));
vi.mock('../../pages/teacher/Classes', () => ({ default: () => <div>Classes</div> }));

describe('TeacherProfile draft integrity', () => {
  beforeEach(() => {
    uploadAvatar.mockReset();
    save.mockReset();
    updateTeacher.mockReset();
    mockSchedule = [];
  });

  it('keeps unsaved biography text after an avatar upload', async () => {
    uploadAvatar.mockResolvedValue('https://example.com/avatar.webp');
    const { container } = render(<TeacherProfile />);
    const bio = screen.getByPlaceholderText('معرفی کوتاه برای نمایش در کنار آزمون‌ها');
    await userEvent.type(bio, 'متن ذخیره‌نشده');
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    await userEvent.upload(input!, new File(['image'], 'avatar.webp', { type: 'image/webp' }));
    expect(await screen.findByText(/تصویر آماده است/)).toBeInTheDocument();
    expect(bio).toHaveValue('متن ذخیره‌نشده');
    expect(updateTeacher).not.toHaveBeenCalled();
  });

  it('renders more than four schedule entries', () => {
    mockSchedule = Array.from({ length: 5 }, (_, index) => ({
      id: `row-${index}`,
      day: index,
      startTime: '08:00',
      endTime: '09:00',
      schoolName: 'مدرسه نمونه',
      className: `کلاس ${index + 1}`,
      subject: 'ریاضی',
    }));
    render(<TeacherProfile />);
    expect(screen.getAllByLabelText('حذف این کلاس از برنامه')).toHaveLength(5);
  });
});
