import type {
  ApiErrorResponse,
  PublishRequest,
  PublishResponse,
  StatusResponse,
} from '../../../shared/contracts/profile';

const requestJson = async <T extends object>(
  url: string,
  token: string,
  init?: RequestInit,
): Promise<T> => {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${token}`,
    },
  });
  const body = (await response.json()) as T | ApiErrorResponse;
  if (!response.ok) {
    const message = 'error' in body ? body.error.message : `请求失败（${response.status}）`;
    throw new Error(message);
  }
  return body as T;
};

export const fetchStatus = (token: string): Promise<StatusResponse> =>
  requestJson<StatusResponse>('/api/status', token);

export const publishProfile = (token: string, payload: PublishRequest): Promise<PublishResponse> =>
  requestJson<PublishResponse>('/api/publish', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
