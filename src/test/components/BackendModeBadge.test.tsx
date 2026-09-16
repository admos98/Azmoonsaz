import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import BackendModeBadge from '../../components/BackendModeBadge';

describe('BackendModeBadge', () => {
  it('renders secure backend badge', () => {
    render(<BackendModeBadge />);
    expect(screen.getByText('بک‌اند امن')).toBeTruthy();
  });
});
