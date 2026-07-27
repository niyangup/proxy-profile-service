import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProfileUploader } from '../../src/features/uploader/ProfileUploader';
import { clashFixture } from './fixtures/profiles';

const emptyStatus = {
  profiles: { primary: null, backup: null },
  urls: {
    primary: {
      surge: 'https://example.com/sub/surge.conf?p=random',
      quanx: 'https://example.com/sub/quanx.conf?p=random',
    },
    backup: {
      surge: 'https://example.com/sub/backup/surge.conf?p=random',
      quanx: 'https://example.com/sub/backup/quanx.conf?p=random',
    },
  },
};

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('profile uploader', () => {
  it('offers independent primary and backup conversion inputs behind one admin token', async () => {
    render(<ProfileUploader />);

    expect(screen.getByLabelText('主用配置文件')).toBeInTheDocument();
    expect(screen.getByLabelText('备用配置文件')).toBeInTheDocument();
    expect(screen.getByLabelText('管理令牌')).toBeInTheDocument();

    const file = new File([clashFixture], 'primary.yaml', { type: 'text/yaml' });
    fireEvent.change(screen.getByLabelText('主用配置文件'), {
      target: { files: [file] },
    });

    await waitFor(() => expect(screen.getByText('转换完成')).toBeInTheDocument());
    expect(screen.getByText('Clash YAML')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '发布主用配置' })).toBeDisabled();
    expect(screen.getByText('输入管理令牌后即可发布。')).toBeInTheDocument();
  });

  it('loads both fixed URL groups with the admin token', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json(emptyStatus));
    vi.stubGlobal('fetch', fetchMock);
    render(<ProfileUploader />);

    fireEvent.change(screen.getByLabelText('管理令牌'), { target: { value: 'admin' } });
    fireEvent.click(screen.getByRole('button', { name: '读取状态' }));

    await waitFor(() => expect(screen.getByText('固定订阅地址')).toBeInTheDocument());
    expect(screen.getByText('主用配置订阅')).toBeInTheDocument();
    expect(screen.getByText('备用配置订阅')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/status',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer admin' }),
      }),
    );
  });

  it('publishes the selected backup slot with the admin token', async () => {
    const publishResponse = {
      ...emptyStatus,
      publishedSlot: 'backup',
      metadata: {
        version: 'backup-version',
        sourceName: 'backup.yaml',
        sourceFormat: 'clash',
        publishedAt: '2026-07-27T00:00:00.000Z',
        warnings: [],
        ignoredSections: [],
        stats: { proxies: 1, groups: 1, rules: 1, skippedRules: 0, removedInfoNodes: 0 },
        digests: { source: 'source', surge: 'surge', quanx: 'quanx' },
      },
    };
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(publishResponse, { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<ProfileUploader />);

    fireEvent.change(screen.getByLabelText('管理令牌'), { target: { value: 'admin' } });
    const file = new File([clashFixture], 'backup.yaml', { type: 'text/yaml' });
    fireEvent.change(screen.getByLabelText('备用配置文件'), {
      target: { files: [file] },
    });
    await waitFor(() => expect(screen.getByRole('button', { name: '发布备用配置' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: '发布备用配置' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(requestInit.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer admin',
    });
    expect(JSON.parse(String(requestInit.body))).toMatchObject({
      slot: 'backup',
      sourceName: 'backup.yaml',
    });
  });

  it('keeps the newest file when an older read finishes later', async () => {
    render(<ProfileUploader />);
    const firstRead = deferred<string>();
    const secondRead = deferred<string>();
    const firstFile = new File([], 'first.yaml', { type: 'text/yaml' });
    const secondFile = new File([], 'second.yaml', { type: 'text/yaml' });
    vi.spyOn(firstFile, 'text').mockReturnValue(firstRead.promise);
    vi.spyOn(secondFile, 'text').mockReturnValue(secondRead.promise);
    const input = screen.getByLabelText('主用配置文件');

    fireEvent.change(input, { target: { files: [firstFile] } });
    fireEvent.change(input, { target: { files: [secondFile] } });
    await act(async () => {
      secondRead.resolve(clashFixture);
      await secondRead.promise;
    });
    expect(screen.getByText('second.yaml')).toBeInTheDocument();

    await act(async () => {
      firstRead.resolve(clashFixture);
      await firstRead.promise;
    });
    expect(screen.getByText('second.yaml')).toBeInTheDocument();
    expect(screen.queryByText('first.yaml')).not.toBeInTheDocument();
  });
});
