import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ProfileUploader } from '../../src/features/uploader/ProfileUploader';
import { clashFixture } from './fixtures/profiles';

describe('profile uploader', () => {
  it('shows conversion statistics before publishing', async () => {
    render(<ProfileUploader />);
    const file = new File([clashFixture], 'profile.yaml', { type: 'text/yaml' });

    fireEvent.change(screen.getByLabelText('配置文件'), {
      target: { files: [file] },
    });

    await waitFor(() => expect(screen.getByText('转换完成')).toBeInTheDocument());
    expect(screen.getByText('Clash YAML')).toBeInTheDocument();
    expect(screen.getByText('输入管理令牌后即可发布。')).toBeInTheDocument();
  });

  it('loads current subscription URLs with the admin token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          current: null,
          urls: {
            surge: 'https://example.com/sub/surge.conf?p=random',
            quanx: 'https://example.com/sub/quanx.conf?p=random',
          },
        }),
      ),
    );
    render(<ProfileUploader />);

    fireEvent.change(screen.getByLabelText('管理令牌'), { target: { value: 'admin' } });
    fireEvent.click(screen.getByRole('button', { name: '读取状态' }));

    await waitFor(() => expect(screen.getByText('固定订阅地址')).toBeInTheDocument());
    expect(screen.getByText('Surge')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      '/api/status',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer admin' }),
      }),
    );
    vi.unstubAllGlobals();
  });
});
