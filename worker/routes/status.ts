import { hasAdminAccess } from '../lib/auth';
import { apiError, jsonResponse } from '../lib/http';
import { readCurrentMetadata, statusPayload } from '../lib/storage';

export const handleStatus = async (request: Request, env: Env): Promise<Response> => {
  if (!hasAdminAccess(request, env)) return apiError('UNAUTHORIZED', '管理令牌无效', 401);
  const current = await readCurrentMetadata(env.PROFILE_BUCKET);
  return jsonResponse(statusPayload(request.url, env.SUBSCRIPTION_TOKEN, current));
};
