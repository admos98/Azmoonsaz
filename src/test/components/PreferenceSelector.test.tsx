import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import PreferenceSelector from '../../components/PreferenceSelector';

const options = [
  { value: 'light' as const, label: 'روشن', description: 'همیشه روشن', icon: Sun },
  { value: 'dark' as const, label: 'تیره', description: 'همیشه تیره', icon: Moon },
  { value: 'system' as const, label: 'سیستم', description: 'هماهنگ', icon: Monitor },
];

function Harness() {
  const [value, setValue] = useState<(typeof options)[number]['value']>('light');
  return <PreferenceSelector label="ظاهر" value={value} options={options} onChange={setValue} />;
}

describe('PreferenceSelector', () => {
  it('supports radio semantics and RTL-aware arrow-key selection', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const light = screen.getByRole('radio', { name: /روشن/ });
    light.focus();

    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('radio', { name: /تیره/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /تیره/ })).toHaveFocus();

    await user.keyboard('{End}');
    expect(screen.getByRole('radio', { name: /سیستم/ })).toBeChecked();
  });
});
