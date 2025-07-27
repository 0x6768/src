// 修改自：https://2x.nz/posts/cf-fastip/#%E9%92%88%E5%AF%B9%E4%BA%8Ecloudflare-workers
// 域名前缀映射配置
const domain_mappings = {
  'quack.duckduckgo.com': 'ddg-proxy.',
//例如：
//'gitea.072103.xyz': 'gitea.',
//则你设置Worker路由为gitea.*都将会反代到gitea.072103.xyz
};

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const current_host = url.host;

  // 强制使用 HTTPS
  if (url.protocol === 'http:') {
    url.protocol = 'https:';
    return Response.redirect(url.href, 301);
  }

  const host_prefix = getProxyPrefix(current_host);
  if (!host_prefix) {
    return new Response('Proxy prefix not matched', { status: 404 });
  }

  // 查找对应目标域名
  let target_host = null;
  for (const [origin_domain, prefix] of Object.entries(domain_mappings)) {
    if (host_prefix === prefix) {
      target_host = origin_domain;
      break;
    }
  }

  if (!target_host) {
    return new Response('No matching target host for prefix', { status: 404 });
  }

  // 构造目标 URL
  const new_url = new URL(request.url);
  new_url.protocol = 'https:';
  new_url.host = target_host;

  // 创建新请求
  const new_headers = new Headers(request.headers);
  new_headers.set('Host', target_host);
  new_headers.set('Referer', new_url.href);

  try {
  if (request.method === 'OPTIONS') {
      return new Response(null, {
          headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
          status: 204
      });
      }
    const response = await fetch(new_url.href, {
      method: request.method,
      headers: new_headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
      redirect: 'manual'
    });
    
    // 复制响应头并添加CORS
    const response_headers = new Headers(response.headers);
    response_headers.delete('Access-Control-Allow-Origin');
    response_headers.delete('Access-Control-Allow-Credentials');
    response_headers.delete('Access-Control-Allow-Headers');
    response_headers.delete('Content-Security-Policy');
    response_headers.delete('Content-Security-Policy-Report-Only');
    response_headers.set('Access-Control-Allow-Origin', '*');
    response_headers.set('Access-Control-Allow-Credentials', 'true');
    response_headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');


    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response_headers
    });
  } catch (err) {
    return new Response(`Proxy Error: ${err.message}`, { status: 502 });
  }
}

function getProxyPrefix(hostname) {
  for (const prefix of Object.values(domain_mappings)) {
    if (hostname.startsWith(prefix)) {
      return prefix;
    }
  }
  return null;
}
