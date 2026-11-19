import { onRequestGet as handleConfigGet, onRequestOptions as handleConfigOptions } from './functions/api/config';
import { onRequestPost as handleLoginPost } from './functions/api/auth/login';
import { onRequestPost as handleAdminGooglePost } from './functions/api/auth/admin-google';
import { onRequestGet as handleEntitlementGet } from './functions/api/auth/entitlement';
import { onRequestGet as handleDownloadTokenGet } from './functions/api/auth/download-token';
import { onRequestGet as handleWorkspaceBootstrapGet } from './functions/api/workspace/bootstrap';
import { onRequestGet as handleDirectoriesGet } from './functions/api/directories';
import { onRequestPost as handleActionPost } from './functions/api/ai/action';
import { onRequestPost as handleMatchPost } from './functions/api/ai/match-context';
import { onRequestPost as handleAnalyzeUrlPost } from './functions/api/ai/analyze-url';
import { onRequestPost as handleMarketerChatPost } from './functions/api/ai/marketer-chat';
import { onRequestGet as handleAdminUsersGet, onRequestPost as handleAdminUsersPost } from './functions/api/admin/users';
import { onRequestGet as handleAdminPromptsGet, onRequestPost as handleAdminPromptsPost } from './functions/api/admin/prompts';
import {
  onRequestDelete as handleAdminDirectoriesDelete,
  onRequestGet as handleAdminDirectoriesGet,
  onRequestPost as handleAdminDirectoriesPost,
} from './functions/api/admin/directories';
import { onRequestPost as handleAdminDirectoriesBulkPost } from './functions/api/admin/directories/bulk';
import { onRequestGet as handleDodoCheckoutGet, onRequestPost as handleDodoCheckoutPost } from './functions/api/dodo/checkout';
import { onRequestPost as handleDodoWebhookPost } from './functions/api/webhooks/dodo';
import {
  onRequestGet as handleCloudStateGet,
  onRequestPost as handleCloudStatePost,
  onRequestOptions as handleCloudStateOptions,
} from './functions/api/user/cloud-state';
import {
  onRequestGet as handleUserWorkspaceGet,
  onRequestPost as handleUserWorkspacePost,
  onRequestOptions as handleUserWorkspaceOptions,
} from './functions/api/user/workspace';
import {
  onRequestGet as handleExtensionVaultGet,
  onRequestPost as handleExtensionVaultPost,
  onRequestOptions as handleExtensionVaultOptions,
} from './functions/api/extension/vault';
import {
  onRequestPost as handleFetchSiteMetadataPost,
  onRequestOptions as handleFetchSiteMetadataOptions,
} from './functions/api/ai/fetch-site-metadata';
import {
  onRequestPost as handleAutoGenerateModulePost,
  onRequestOptions as handleAutoGenerateModuleOptions,
} from './functions/api/ai/auto-generate-module';
import { onRequestGet as handleReleasesGet, onRequestOptions as handleReleasesOptions } from './functions/api/releases';
import { onRequestGet as handleChangelogGet, onRequestOptions as handleChangelogOptions } from './functions/api/changelog';
import { onRequestGet as handleExtensionDownloadGet, onRequestOptions as handleExtensionDownloadOptions } from './functions/api/download/extension';

export interface CloudflareEnv {
  ASSETS?: { fetch: (request: Request) => Promise<Response> };
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  GEMINI_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string;
  ENTITLEMENT_SIGNING_SECRET?: string;
  APP_URL?: string;
  DODO_PAYMENTS_API_KEY?: string;
  DODO_PAYMENTS_MODE?: string;
  DODO_PAYMENTS_PRODUCT_ID?: string;
  DODO_PAYMENTS_UNLIMITED_PRODUCT_ID?: string;
  DODO_PAYMENTS_WEBHOOK_KEY?: string;
  [key: string]: any;
}

const DEFAULT_OG_ORIGIN = 'https://smartposter.pro';

export default {
  async fetch(request: Request, env: CloudflareEnv): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      if (url.pathname === '/api/extension/vault') {
        return handleExtensionVaultOptions({ request });
      }
      if (url.pathname === '/api/user/cloud-state') {
        return handleCloudStateOptions();
      }
      if (url.pathname === '/api/user/workspace') {
        return handleUserWorkspaceOptions();
      }
      if (url.pathname === '/api/ai/fetch-site-metadata') {
        return handleFetchSiteMetadataOptions();
      }
      if (url.pathname === '/api/ai/auto-generate-module') {
        return handleAutoGenerateModuleOptions();
      }
      if (url.pathname === '/api/releases') {
        return handleReleasesOptions();
      }
      if (url.pathname === '/api/changelog') {
        return handleChangelogOptions();
      }
      if (url.pathname === '/api/download/extension') {
        return handleExtensionDownloadOptions();
      }
      return handleConfigOptions();
    }

    if (url.pathname === '/api/config') {
      return handleConfigGet({ env });
    }

    if (url.pathname === '/api/auth/login' && request.method === 'POST') {
      return handleLoginPost({ request, env });
    }

    if (url.pathname === '/api/auth/admin-google' && request.method === 'POST') {
      return handleAdminGooglePost({ request, env });
    }

    if (url.pathname === '/api/auth/entitlement' && request.method === 'GET') {
      return handleEntitlementGet({ request, env });
    }

    if (url.pathname === '/api/auth/download-token' && request.method === 'GET') {
      return handleDownloadTokenGet({ request, env });
    }

    if (url.pathname === '/api/workspace/bootstrap' && request.method === 'GET') {
      return handleWorkspaceBootstrapGet({ request, env });
    }

    if (url.pathname === '/api/directories' && request.method === 'GET') {
      return handleDirectoriesGet({ request, env });
    }

    if (url.pathname === '/api/releases' && request.method === 'GET') {
      return handleReleasesGet({ request, env });
    }

    if (url.pathname === '/api/changelog' && request.method === 'GET') {
      return handleChangelogGet({ request, env });
    }

    if (url.pathname === '/api/download/extension' && request.method === 'GET') {
      return handleExtensionDownloadGet({ request, env });
    }

    if (url.pathname === '/api/admin/users' && request.method === 'GET') {
      return handleAdminUsersGet({ env });
    }

    if ((url.pathname === '/api/admin/users' || url.pathname === '/api/admin/users/tier') && request.method === 'POST') {
      return handleAdminUsersPost({ request, env });
    }

    if (url.pathname === '/api/admin/prompts' && request.method === 'GET') {
      return handleAdminPromptsGet({ env });
    }

    if (url.pathname === '/api/admin/prompts' && request.method === 'POST') {
      return handleAdminPromptsPost({ request, env });
    }

    if (url.pathname === '/api/admin/directories' && request.method === 'GET') {
      return handleAdminDirectoriesGet({ request, env });
    }

    if (url.pathname === '/api/admin/directories' && request.method === 'POST') {
      return handleAdminDirectoriesPost({ request, env });
    }

    if (url.pathname === '/api/admin/directories/bulk' && request.method === 'POST') {
      return handleAdminDirectoriesBulkPost({ request, env });
    }

    if (url.pathname.startsWith('/api/admin/directories/') && request.method === 'DELETE') {
      const id = decodeURIComponent(url.pathname.slice('/api/admin/directories/'.length));
      return handleAdminDirectoriesDelete({ request, env, params: { id } });
    }

    if (url.pathname === '/api/ai/action' && request.method === 'POST') {
      return handleActionPost({ request, env });
    }

    if (url.pathname === '/api/ai/match-context' && request.method === 'POST') {
      return handleMatchPost({ request, env });
    }

    if ((url.pathname === '/api/ai/analyze-url' || url.pathname === '/api/ai/scan-url') && request.method === 'POST') {
      return handleAnalyzeUrlPost({ request, env });
    }

    if (
      (url.pathname === '/api/ai/marketer-chat' ||
        url.pathname === '/api/ai/assistant-chat' ||
        url.pathname === '/api/ai-assistant/chat') &&
      request.method === 'POST'
    ) {
      return handleMarketerChatPost({ request, env });
    }

    if (url.pathname === '/api/ai/fetch-site-metadata' && request.method === 'POST') {
      return handleFetchSiteMetadataPost({ request });
    }

    if (url.pathname === '/api/ai/auto-generate-module' && request.method === 'POST') {
      return handleAutoGenerateModulePost({ request, env });
    }

    if (url.pathname === '/api/user/cloud-state' && request.method === 'GET') {
      return handleCloudStateGet({ request, env });
    }

    if (url.pathname === '/api/user/cloud-state' && request.method === 'POST') {
      return handleCloudStatePost({ request, env });
    }

    if (url.pathname === '/api/user/workspace' && request.method === 'GET') {
      return handleUserWorkspaceGet({ request, env });
    }

    if (url.pathname === '/api/user/workspace' && request.method === 'POST') {
      return handleUserWorkspacePost({ request, env });
    }

    if (url.pathname === '/api/extension/vault' && request.method === 'GET') {
      return handleExtensionVaultGet({ request, env });
    }

    if (url.pathname === '/api/extension/vault' && request.method === 'POST') {
      return handleExtensionVaultPost({ request, env });
    }

    if (url.pathname === '/api/dodo/checkout' && request.method === 'GET') {
      return handleDodoCheckoutGet({ request, env });
    }

    if (url.pathname === '/api/dodo/checkout' && request.method === 'POST') {
      return handleDodoCheckoutPost({ request, env });
    }

    if (url.pathname === '/api/webhooks/dodo' && request.method === 'POST') {
      return handleDodoWebhookPost({ request, env });
    }

    if (url.pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ success: false, error: `API endpoint not found: ${url.pathname}` }), {
        status: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
      });
    }

    // Serve static assets with SPA routing fallback when ASSETS binding is available
    if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      let assetRequest = request;
      if (
        url.pathname === '/privacy' ||
        url.pathname === '/terms' ||
        url.pathname === '/login' ||
        url.pathname === '/dashboard' ||
        url.pathname === '/admin'
      ) {
        const htmlUrl = new URL(request.url);
        htmlUrl.pathname = `${url.pathname}.html`;
        assetRequest = new Request(htmlUrl.toString(), request);
      } else if (url.pathname === '/auth/callback' || url.pathname === '/auth/callback.html') {
        const htmlUrl = new URL(request.url);
        htmlUrl.pathname = '/auth/callback.html';
        assetRequest = new Request(htmlUrl.toString(), request);
      } else if (url.pathname === '/opengrapgh' || url.pathname === '/opengraph' || url.pathname === '/opengraph.html') {
        const htmlUrl = new URL(request.url);
        htmlUrl.pathname = '/opengrapgh.html';
        assetRequest = new Request(htmlUrl.toString(), request);
      }
      const assetResponse = await env.ASSETS.fetch(assetRequest);
      const contentType = assetResponse.headers.get('content-type') || '';
      if (contentType.includes('text/html') && (url.pathname === '/' || url.pathname === '/index.html')) {
        const origin = String(env.APP_URL || url.origin).trim().replace(/\/+$/, '');
        if (origin && origin !== DEFAULT_OG_ORIGIN) {
          const html = (await assetResponse.text()).split(DEFAULT_OG_ORIGIN).join(origin);
          const headers = new Headers(assetResponse.headers);
          headers.delete('content-length');
          return new Response(html, {
            status: assetResponse.status,
            statusText: assetResponse.statusText,
            headers,
          });
        }
      }
      return assetResponse;
    }

    return new Response('Not Found', { status: 404 });
  },
};
