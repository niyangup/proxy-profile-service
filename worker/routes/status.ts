import { hasAdminAccess } from '../lib/auth';
import { apiError, jsonResponse } from '../lib/http';
import { readAllMetadata, statusPayload } from '../lib/storage';

export const handleStatus = async (request: Request, env: Env): Promise<Response> => {
  if (!(await hasAdminAccess(request, env))) {
    return apiError('UNAUTHORIZED', '管理令牌无效', 401);
  }
  const profiles = await readAllMetadata(env.PROFILE_STORE);
  return jsonResponse(statusPayload(request.url, env.SUBSCRIPTION_TOKEN, profiles));
};
