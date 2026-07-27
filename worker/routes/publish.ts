import type { PublishResponse, PublishedProfileMetadata } from '../../shared/contracts/profile';
import { hasAdminAccess } from '../lib/auth';
import { apiError, jsonResponse, readTextWithLimit } from '../lib/http';
import { createDigests, subscriptionUrls, writeCurrentProfile } from '../lib/storage';
import { validatePublishRequest } from '../lib/validation';

const MAX_REQUEST_BYTES = 10 * 1024 * 1024;

const errorResponse = (error: unknown): Response => {
  const code = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
  if (code === 'PAYLOAD_TOO_LARGE') return apiError(code, '上传内容超过限制', 413);
  if (code === 'INVALID_PAYLOAD') return apiError(code, '发布数据结构无效', 400);
  if (code === 'INVALID_SURGE_OUTPUT') return apiError(code, 'Surge 输出缺少必要配置段', 400);
  if (code === 'INVALID_QUANX_OUTPUT')
    return apiError(code, 'Quantumult X 输出缺少必要配置段', 400);
  if (code === 'INVALID_JSON') return apiError(code, '请求不是有效 JSON', 400);
  return apiError('PUBLISH_FAILED', '发布失败，当前版本未被替换', 500);
};

export const handlePublish = async (request: Request, env: Env): Promise<Response> => {
  if (!hasAdminAccess(request, env)) return apiError('UNAUTHORIZED', '管理令牌无效', 401);
  if (!request.headers.get('Content-Type')?.toLowerCase().includes('application/json')) {
    return apiError('UNSUPPORTED_MEDIA_TYPE', '仅接受 application/json', 415);
  }

  try {
    const body = await readTextWithLimit(request, MAX_REQUEST_BYTES);
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      throw new Error('INVALID_JSON');
    }
    const payload = validatePublishRequest(parsed);
    const digests = await createDigests(payload);
    const publishedAt = new Date().toISOString();
    const version = `${publishedAt.replaceAll(/[:.]/g, '-')}-${digests.source.slice(0, 12)}`;
    const metadata: PublishedProfileMetadata = {
      version,
      sourceName: payload.sourceName,
      sourceFormat: payload.sourceFormat,
      publishedAt,
      warnings: payload.warnings,
      ignoredSections: payload.ignoredSections,
      stats: payload.stats,
      digests,
    };
    await writeCurrentProfile(env.PROFILE_STORE, {
      metadata,
      source: payload.source,
      surge: payload.surge,
      quanx: payload.quanx,
    });

    const response: PublishResponse = {
      metadata,
      urls: subscriptionUrls(request.url, env.SUBSCRIPTION_TOKEN),
    };
    return jsonResponse(response, 201);
  } catch (error) {
    return errorResponse(error);
  }
};
