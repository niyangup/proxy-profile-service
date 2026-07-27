import { apiError, jsonResponse, logWorkerError } from './lib/http';
import { handlePublish } from './routes/publish';
import { handleStatus } from './routes/status';
import { handleSubscription } from './routes/subscription';

const routeRequest = async (request: Request, env: Env): Promise<Response | undefined> => {
  const url = new URL(request.url);
  if (request.method === 'GET' && url.pathname === '/api/health') {
    return jsonResponse({ status: 'ok' });
  }
  if (request.method === 'GET' && url.pathname === '/api/status') {
    return handleStatus(request, env);
  }
  if (request.method === 'POST' && url.pathname === '/api/publish') {
    return handlePublish(request, env);
  }
  if (request.method === 'GET' && url.pathname === '/sub/surge.conf') {
    return handleSubscription(request, env, 'primary', 'surge');
  }
  if (request.method === 'GET' && url.pathname === '/sub/quanx.conf') {
    return handleSubscription(request, env, 'primary', 'quanx');
  }
  if (request.method === 'GET' && url.pathname === '/sub/backup/surge.conf') {
    return handleSubscription(request, env, 'backup', 'surge');
  }
  if (request.method === 'GET' && url.pathname === '/sub/backup/quanx.conf') {
    return handleSubscription(request, env, 'backup', 'quanx');
  }
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/sub/')) {
    return apiError('NOT_FOUND', 'Not Found', 404);
  }
  return undefined;
};

export default {
  async fetch(request, env): Promise<Response> {
    try {
      const response = await routeRequest(request, env);
      return response ?? env.ASSETS.fetch(request);
    } catch (error) {
      logWorkerError('route', request, error);
      return apiError('INTERNAL_ERROR', '服务暂时不可用', 500);
    }
  },
} satisfies ExportedHandler<Env>;
