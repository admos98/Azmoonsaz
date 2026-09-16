import { describe, it, expect, vi } from 'vitest';
import { logger } from '../../lib/logger';

describe('logger', () => {
  it('error always calls console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logger.error('test error');
    expect(spy).toHaveBeenCalledWith('test error');
    spy.mockRestore();
  });

  it('warn calls console.warn', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logger.warn('test warn');
    expect(spy).toHaveBeenCalledWith('test warn');
    spy.mockRestore();
  });

  it('log calls console.log', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.log('test log');
    expect(spy).toHaveBeenCalledWith('test log');
    spy.mockRestore();
  });
});
