import { render, screen } from '@testing-library/react';
import { ProctorFlags } from '../../features/exam-guard/ProctorFlags';

describe('ProctorFlags (Wave C)', () => {
  it('renders nothing when there are no flags and no warnings', () => {
    const { container } = render(<ProctorFlags flags={{}} warningCount={0} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId('proctor-flags')).not.toBeInTheDocument();
  });

  it('lists flagged events with counts and Persian labels', () => {
    render(
      <ProctorFlags flags={{ tabHidden: 3, copyAttempt: 1, bogus: 9 }} />,
    );
    const box = screen.getByTestId('proctor-flags');
    expect(box).toHaveTextContent('ترک صفحه آزمون: ۳ بار');
    expect(box).toHaveTextContent('تلاش برای کپی: ۱ بار');
    // non-whitelisted keys never render
    expect(box).not.toHaveTextContent('bogus');
  });

  it('surfaces a prior warning with the block consequence', () => {
    render(<ProctorFlags flags={{}} warningCount={1} />);
    const box = screen.getByTestId('proctor-flags');
    expect(box).toHaveTextContent('هشدار قبلی: ۱ مورد');
    expect(box).toHaveTextContent('مسدودسازی دائمی');
  });

  it('hides zero-valued counters', () => {
    render(<ProctorFlags flags={{ tabHidden: 0, windowBlur: 2 }} />);
    const box = screen.getByTestId('proctor-flags');
    expect(box).not.toHaveTextContent('ترک صفحه');
    expect(box).toHaveTextContent('خروج از فوکوس پنجره: ۲ بار');
  });
});
