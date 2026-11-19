// Lightweight, resilient Supabase REST client for Manifest V3 extension
// Uses direct HTTPS Fetch to Supabase PostgREST & Storage APIs with 401 refresh retry & offline fallback

class SupabaseClient {
  constructor(config = {}) {
    this.url = (config.url || '').trim().replace(/\/+$/, '');
    this.anonKey = (config.anonKey || '').trim();
    this.userId = config.userId || 'guest';
    this.userEmail = config.userEmail || '';
    this.tier = config.tier || 'basic';
    this.accessToken = config.accessToken || null;
    this.refreshToken = config.refreshToken || null;
    this.onTokenRefresh = typeof config.onTokenRefresh === 'function' ? config.onTokenRefresh : null;
    this.onAuthInvalid = typeof config.onAuthInvalid === 'function' ? config.onAuthInvalid : null;
    this.refreshCoordinator = typeof config.refreshCoordinator === 'function' ? config.refreshCoordinator : null;
    this._refreshPromise = null;
  }

  static isJwtExpired(token, leewaySeconds = 0) {
    try {
      const raw = String(token || '').trim();
      const parts = raw.split('.');
      if (parts.length < 2) return false;
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
      const payload = JSON.parse(atob(padded));
      if (!payload || typeof payload.exp !== 'number') return false;
      return (payload.exp * 1000) <= (Date.now() + leewaySeconds * 1000);
    } catch (_) {
      return false;
    }
  }

  setOnTokenRefresh(cb) {
    this.onTokenRefresh = typeof cb === 'function' ? cb : null;
  }

  setOnAuthInvalid(cb) {
    this.onAuthInvalid = typeof cb === 'function' ? cb : null;
  }

  setRefreshCoordinator(fn) {
    this.refreshCoordinator = typeof fn === 'function' ? fn : null;
  }

  setSession(session = {}) {
    if (!session || !session.user) {
      this.clearSession();
      return;
    }
    this.userId = session.user.id || 'guest';
    this.userEmail = session.user.email || '';
    this.tier = session.user.tier || 'basic';
    this.accessToken = session.accessToken || session.token || null;
    this.refreshToken = session.refreshToken || null;
  }

  clearSession() {
    this.userId = 'guest';
    this.userEmail = '';
    this.tier = 'basic';
    this.accessToken = null;
    this.refreshToken = null;
  }

  isConfigured() {
    return Boolean(this.url && this.anonKey && this.url.startsWith('https://'));
  }

  isLoggedIn() {
    if (!this.isConfigured() || !this.accessToken || !this.userId || this.userId === 'guest') {
      return false;
    }
    if (SupabaseClient.isJwtExpired(this.accessToken, 0) && !this.refreshToken) {
      return false;
    }
    return true;
  }

  getUserTier() {
    return this.tier || 'basic';
  }

  getHeaders(preferMerge = false, contentType = 'application/json') {
    const token = this.accessToken || this.anonKey;
    const headers = {
      apikey: this.anonKey,
      Authorization: `Bearer ${token}`,
    };
    if (contentType) {
      headers['Content-Type'] = contentType;
    }
    if (preferMerge) {
      headers.Prefer = 'resolution=merge-duplicates,return=representation';
    }
    return headers;
  }

  async refreshSession() {
    if (!this.isConfigured() || !this.refreshToken) return null;
    if (this._refreshPromise) return this._refreshPromise;

    this._refreshPromise = (async () => {
      try {
        if (this.refreshCoordinator) {
          const coordRes = await this.refreshCoordinator({
            accessToken: this.accessToken,
            refreshToken: this.refreshToken,
            supabaseUrl: this.url,
            anonKey: this.anonKey,
          });
          if (coordRes?.ok && coordRes.accessToken) {
            this.accessToken = coordRes.accessToken;
            this.refreshToken = coordRes.refreshToken || this.refreshToken;
            return {
              accessToken: this.accessToken,
              refreshToken: this.refreshToken,
            };
          }
          if (coordRes?.rejected) {
            const failedToken = this.accessToken || '';
            this.clearSession();
            if (this.onAuthInvalid) {
              try {
                await this.onAuthInvalid({ status: coordRes.status || 401, reason: 'refresh_rejected', failedToken });
              } catch (_) {}
            }
          }
          return null;
        }

        const res = await fetch(`${this.url}/auth/v1/token?grant_type=refresh_token`, {
          method: 'POST',
          headers: {
            apikey: this.anonKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refresh_token: this.refreshToken }),
        });
        if (!res.ok) {
          if (res.status === 400 || res.status === 401 || res.status === 403) {
            const failedToken = this.accessToken || '';
            this.clearSession();
            if (this.onAuthInvalid) {
              try {
                await this.onAuthInvalid({ status: res.status, reason: 'refresh_rejected', failedToken });
              } catch (_) {}
            }
          }
          return null;
        }
        const data = await res.json().catch(() => null);
        if (!data?.access_token) return null;

        this.accessToken = data.access_token;
        this.refreshToken = data.refresh_token || this.refreshToken;
        if (this.onTokenRefresh) {
          try {
            await this.onTokenRefresh({
              accessToken: this.accessToken,
              refreshToken: this.refreshToken,
              user: data.user || null,
            });
          } catch (_) {}
        }
        return {
          accessToken: this.accessToken,
          refreshToken: this.refreshToken,
        };
      } catch (_) {
        return null;
      } finally {
        this._refreshPromise = null;
      }
    })();

    return this._refreshPromise;
  }

  async parseErrorDetail(res) {
    try {
      const txt = await res.text();
      if (!txt) return `HTTP ${res.status}: ${res.statusText}`;
      try {
        const parsed = JSON.parse(txt);
        const msg = parsed?.message || parsed?.error || parsed?.hint || txt;
        const code = parsed?.code ? ` [${parsed.code}]` : '';
        return `HTTP ${res.status}${code}: ${String(msg).slice(0, 220)}`;
      } catch {
        return `HTTP ${res.status}: ${txt.slice(0, 220)}`;
      }
    } catch {
      return `HTTP ${res.status}: ${res.statusText}`;
    }
  }

  async requestWithAuthRetry(endpoint, buildOptions) {
    const tokenUsedFirst = this.accessToken;
    if (tokenUsedFirst && SupabaseClient.isJwtExpired(tokenUsedFirst, 30)) {
      if (this.refreshToken) {
        await this.refreshSession();
      } else {
        this.clearSession();
        if (this.onAuthInvalid) {
          try {
            await this.onAuthInvalid({ status: 401, reason: 'token_expired_no_refresh', failedToken: tokenUsedFirst });
          } catch (_) {}
        }
      }
    }

    let res = await fetch(endpoint, buildOptions());
    if (res.status === 401) {
      let refreshed = null;
      if (this.refreshToken) {
        refreshed = await this.refreshSession();
        if (refreshed?.accessToken) {
          res = await fetch(endpoint, buildOptions());
        }
      }
      if (res.status === 401) {
        const failedToken = this.accessToken || tokenUsedFirst || '';
        this.clearSession();
        if (this.onAuthInvalid) {
          try {
            await this.onAuthInvalid({ status: 401, reason: 'unauthorized', failedToken });
          } catch (_) {}
        }
      }
    }
    return res;
  }

  // Refresh profile from Supabase to get the latest tier (e.g. if toggled by Admin)
  async fetchUserProfile() {
    if (!this.isLoggedIn()) {
      return { success: false, guest: true, tier: 'basic' };
    }

    const normalizeProfileRow = (row) => {
      const role = String(row?.role || 'user').toLowerCase() === 'admin' ? 'admin' : 'user';
      const rawTier = String(row?.tier || 'basic').trim().toLowerCase();
      if (role === 'admin' || rawTier === 'unlimited' || rawTier.startsWith('unlimited')) {
        return { role, tier: 'unlimited' };
      }
      const tier = (rawTier === 'pro' || rawTier === 'pro_lifetime' || rawTier === 'pro-lifetime' || rawTier === 'lifetime' || rawTier === 'premium' || rawTier.startsWith('pro'))
        ? 'pro'
        : 'basic';
      return { role, tier };
    };

    try {
      const endpoint = `${this.url}/rest/v1/profiles?id=eq.${encodeURIComponent(this.userId)}&select=*`;
      const res = await this.requestWithAuthRetry(endpoint, () => ({
        method: 'GET',
        headers: this.getHeaders(),
      }));

      let rows = res.ok ? await res.json().catch(() => []) : [];
      if ((!Array.isArray(rows) || rows.length === 0) && this.userEmail) {
        const emailEndpoint = `${this.url}/rest/v1/profiles?email=eq.${encodeURIComponent(this.userEmail.toLowerCase())}&select=*`;
        const emailRes = await this.requestWithAuthRetry(emailEndpoint, () => ({
          method: 'GET',
          headers: this.getHeaders(),
        }));
        if (emailRes.ok) {
          rows = await emailRes.json().catch(() => []);
        }
      }

      if (Array.isArray(rows) && rows.length > 0) {
        const normalized = normalizeProfileRow(rows[0]);
        this.tier = normalized.tier;
        return { success: true, profile: rows[0], tier: normalized.tier, role: normalized.role };
      }
      return { success: false, tier: this.tier };
    } catch (err) {
      return { success: false, error: err.message, tier: this.tier };
    }
  }

  async testConnection() {
    if (!this.isConfigured()) {
      return { success: false, error: 'Supabase URL and Anon Key must be configured.' };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(`${this.url}/rest/v1/`, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok || res.status === 200 || res.status === 404 || res.status === 401) {
        return { success: true, message: 'Connected to Supabase endpoint.' };
      }

      return {
        success: false,
        error: `Supabase returned HTTP ${res.status}: ${res.statusText}`,
      };
    } catch (err) {
      if (err.name === 'AbortError') {
        return { success: false, error: 'Connection timed out after 6 seconds.' };
      }
      return { success: false, error: err.message || 'Network error connecting to Supabase.' };
    }
  }

  // ==========================================
  // BRANDS TABLE SYNC (Scoped by user_id,id + soft delete)
  // ==========================================
  async fetchBrands() {
    if (!this.isLoggedIn()) return { success: false, error: 'Guest mode active', offline: true, guest: true };

    try {
      const endpoint = `${this.url}/rest/v1/brands?user_id=eq.${encodeURIComponent(this.userId)}&select=*`;
      const res = await this.requestWithAuthRetry(endpoint, () => ({
        method: 'GET',
        headers: this.getHeaders(),
      }));

      if (!res.ok) {
        return { success: false, error: `HTTP ${res.status}: ${res.statusText}` };
      }

      const rows = await res.json();
      const brands = (rows || []).map((row) => {
        const d = row.data || {};
        return {
          ...d,
          brandId: row.id,
          campaignId: d.campaignId || row.id,
          brandName: row.name || d.brandName || d.campaignName || 'Brand',
          campaignName: d.campaignName || row.name || d.brandName || 'Brand',
          updatedAt: row.updated_at || d.updatedAt || new Date().toISOString(),
          deletedAt: row.deleted_at || d.deletedAt || null,
        };
      });

      return { success: true, brands };
    } catch (err) {
      return { success: false, error: err.message, offline: true };
    }
  }

  async upsertBrands(brandProfiles = []) {
    if (!this.isLoggedIn()) return { success: true, offline: true, guest: true };
    if (!Array.isArray(brandProfiles) || brandProfiles.length === 0) return { success: true, count: 0 };

    try {
      const rows = brandProfiles
        .filter((b) => b && (b.brandId || b.campaignId))
        .map((b) => {
          const id = String(b.brandId || b.campaignId);
          const name = String(b.campaignName || b.brandName || b.brandInfo?.name || 'Brand');
          const updatedAt = b.updatedAt || new Date().toISOString();
          const deletedAt = b.deletedAt || null;
          return {
            id,
            user_id: this.userId,
            name,
            data: { ...b, brandId: id, campaignId: b.campaignId || id, brandName: b.brandName || name, campaignName: b.campaignName || name, updatedAt, ...(deletedAt ? { deletedAt } : {}) },
            updated_at: updatedAt,
            deleted_at: deletedAt,
          };
        });

      if (rows.length === 0) return { success: true, count: 0 };

      const endpoint = `${this.url}/rest/v1/brands?on_conflict=user_id,id`;
      let res = await this.requestWithAuthRetry(endpoint, () => ({
        method: 'POST',
        headers: this.getHeaders(true),
        body: JSON.stringify(rows),
      }));

      if (!res.ok) {
        const detail = await this.parseErrorDetail(res);
        if (detail.includes('42P10') || detail.includes('no unique or exclusion constraint')) {
          res = await this.requestWithAuthRetry(`${this.url}/rest/v1/brands?on_conflict=id`, () => ({
            method: 'POST',
            headers: this.getHeaders(true),
            body: JSON.stringify(rows),
          }));
          if (res.ok) return { success: true, count: rows.length };
          return { success: false, error: await this.parseErrorDetail(res) };
        }
        return { success: false, error: detail };
      }

      return { success: true, count: rows.length };
    } catch (err) {
      return { success: false, error: err.message, offline: true };
    }
  }

  async softDeleteBrand(brandId, deletedAt = new Date().toISOString()) {
    if (!this.isLoggedIn() || !brandId) return { success: true, offline: true };
    try {
      const endpoint = `${this.url}/rest/v1/brands?on_conflict=user_id,id`;
      const row = [{
        id: String(brandId),
        user_id: this.userId,
        name: 'Deleted Campaign',
        data: { brandId: String(brandId), deletedAt, updatedAt: deletedAt },
        updated_at: deletedAt,
        deleted_at: deletedAt,
      }];
      let res = await this.requestWithAuthRetry(endpoint, () => ({
        method: 'POST',
        headers: this.getHeaders(true),
        body: JSON.stringify(row),
      }));
      if (!res.ok) {
        const detail = await this.parseErrorDetail(res);
        if (detail.includes('42P10') || detail.includes('no unique or exclusion constraint')) {
          res = await this.requestWithAuthRetry(`${this.url}/rest/v1/brands?on_conflict=id`, () => ({
            method: 'POST',
            headers: this.getHeaders(true),
            body: JSON.stringify(row),
          }));
          if (res.ok) return { success: true };
          return { success: false, error: await this.parseErrorDetail(res) };
        }
        return { success: false, error: detail };
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message, offline: true };
    }
  }

  // ==========================================
  // COMPLETED URLS TABLE SYNC
  // ==========================================
  async fetchCompletedUrls() {
    if (!this.isLoggedIn()) return { success: false, error: 'Guest mode active', offline: true, guest: true };

    try {
      const endpoint = `${this.url}/rest/v1/completed_urls?user_id=eq.${encodeURIComponent(this.userId)}&select=*`;
      const res = await this.requestWithAuthRetry(endpoint, () => ({
        method: 'GET',
        headers: this.getHeaders(),
      }));

      if (!res.ok) {
        return { success: false, error: `HTTP ${res.status}: ${res.statusText}` };
      }

      const rows = await res.json();
      const completedUrls = {};
      (rows || []).forEach((row) => {
        completedUrls[row.id] = {
          id: row.id,
          brandId: row.brand_id,
          brandName: row.brand_name,
          url: row.url,
          domain: row.domain,
          category: row.category,
          completedAt: row.completed_at,
        };
      });

      return { success: true, completedUrls };
    } catch (err) {
      return { success: false, error: err.message, offline: true };
    }
  }

  async upsertCompletedUrls(completedUrlsMap = {}) {
    if (!this.isLoggedIn()) return { success: true, offline: true, guest: true };
    const entries = Object.entries(completedUrlsMap || {});
    if (entries.length === 0) return { success: true, count: 0 };

    try {
      const rows = entries
        .map(([key, item]) => {
          const rec = item || {};
          const id = String(rec.id || key || rec.url || rec.domain || '').trim();
          if (!id) return null;
          return {
            id: id.slice(0, 500),
            user_id: this.userId,
            brand_id: String(rec.brandId || 'brand-default'),
            brand_name: String(rec.brandName || 'Brand'),
            url: String(rec.url || ''),
            domain: String(rec.domain || ''),
            category: String(rec.category || 'outreach'),
            completed_at: rec.completedAt || new Date().toISOString(),
          };
        })
        .filter(Boolean);

      if (rows.length === 0) return { success: true, count: 0 };

      const endpoint = `${this.url}/rest/v1/completed_urls?on_conflict=user_id,id`;
      const res = await this.requestWithAuthRetry(endpoint, () => ({
        method: 'POST',
        headers: this.getHeaders(true),
        body: JSON.stringify(rows),
      }));

      if (!res.ok) {
        return { success: false, error: await this.parseErrorDetail(res) };
      }

      return { success: true, count: rows.length };
    } catch (err) {
      return { success: false, error: err.message, offline: true };
    }
  }

  async deleteCompletedUrl(id) {
    if (!this.isLoggedIn() || !id) return { success: true, offline: true };
    try {
      const endpoint = `${this.url}/rest/v1/completed_urls?user_id=eq.${encodeURIComponent(this.userId)}&id=eq.${encodeURIComponent(String(id))}`;
      const res = await this.requestWithAuthRetry(endpoint, () => ({
        method: 'DELETE',
        headers: this.getHeaders(),
      }));
      if (!res.ok) {
        return { success: false, error: `HTTP ${res.status}: ${res.statusText}` };
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message, offline: true };
    }
  }

  async clearCompletedUrls() {
    if (!this.isLoggedIn()) return { success: true, offline: true };
    try {
      const endpoint = `${this.url}/rest/v1/completed_urls?user_id=eq.${encodeURIComponent(this.userId)}`;
      const res = await this.requestWithAuthRetry(endpoint, () => ({
        method: 'DELETE',
        headers: this.getHeaders(),
      }));
      if (!res.ok) {
        return { success: false, error: `HTTP ${res.status}: ${res.statusText}` };
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message, offline: true };
    }
  }

  // ==========================================
  // USER SETTINGS TABLE SYNC
  // ==========================================
  async fetchUserSettings() {
    if (!this.isLoggedIn()) return { success: false, error: 'Guest mode active', offline: true, guest: true };

    try {
      const endpoint = `${this.url}/rest/v1/user_settings?user_id=eq.${encodeURIComponent(this.userId)}&select=*`;
      const res = await this.requestWithAuthRetry(endpoint, () => ({
        method: 'GET',
        headers: this.getHeaders(),
      }));

      if (!res.ok) {
        return { success: false, error: `HTTP ${res.status}: ${res.statusText}` };
      }

      const rows = await res.json();
      if (rows && rows.length > 0) {
        return { success: true, settings: rows[0].settings || {}, updatedAt: rows[0].updated_at || rows[0].settings?.updatedAt || null };
      }
      return { success: true, settings: null, updatedAt: null };
    } catch (err) {
      return { success: false, error: err.message, offline: true };
    }
  }

  async upsertUserSettings(settingsObj = {}) {
    if (!this.isLoggedIn()) return { success: true, offline: true, guest: true };

    try {
      const updatedAt = settingsObj?.updatedAt || new Date().toISOString();
      const payload = [{
        user_id: this.userId,
        settings: { ...settingsObj, updatedAt },
        updated_at: updatedAt,
      }];

      const endpoint = `${this.url}/rest/v1/user_settings?on_conflict=user_id`;
      const res = await this.requestWithAuthRetry(endpoint, () => ({
        method: 'POST',
        headers: this.getHeaders(true),
        body: JSON.stringify(payload),
      }));

      if (!res.ok) {
        return { success: false, error: await this.parseErrorDetail(res) };
      }

      return { success: true, updatedAt };
    } catch (err) {
      return { success: false, error: err.message, offline: true };
    }
  }

  // ==========================================
  // USER WORKSPACE PREFS (Bookmarks, Custom Dirs, Research Config)
  // ==========================================
  async fetchWorkspacePrefs() {
    if (!this.isLoggedIn()) return { success: false, error: 'Guest mode active', offline: true, guest: true };
    try {
      const endpoint = `${this.url}/rest/v1/user_workspace_prefs?user_id=eq.${encodeURIComponent(this.userId)}&select=*`;
      const res = await this.requestWithAuthRetry(endpoint, () => ({
        method: 'GET',
        headers: this.getHeaders(),
      }));
      if (!res.ok) {
        return { success: false, error: `HTTP ${res.status}: ${res.statusText}` };
      }
      const rows = await res.json();
      if (Array.isArray(rows) && rows.length > 0) {
        return { success: true, prefs: rows[0], updatedAt: rows[0].updated_at || null };
      }
      return { success: true, prefs: null, updatedAt: null };
    } catch (err) {
      return { success: false, error: err.message, offline: true };
    }
  }

  async upsertWorkspacePrefs(prefs = {}) {
    if (!this.isLoggedIn()) return { success: true, offline: true, guest: true };
    try {
      const updatedAt = prefs.updated_at || new Date().toISOString();
      const payload = [{
        user_id: this.userId,
        bookmarked_directory_ids: Array.isArray(prefs.bookmarked_directory_ids) ? prefs.bookmarked_directory_ids : [],
        custom_directories: Array.isArray(prefs.custom_directories) ? prefs.custom_directories : [],
        research_config: prefs.research_config && typeof prefs.research_config === 'object' ? prefs.research_config : {},
        updated_at: updatedAt,
      }];
      const endpoint = `${this.url}/rest/v1/user_workspace_prefs?on_conflict=user_id`;
      const res = await this.requestWithAuthRetry(endpoint, () => ({
        method: 'POST',
        headers: this.getHeaders(true),
        body: JSON.stringify(payload),
      }));
      if (!res.ok) {
        return { success: false, error: await this.parseErrorDetail(res) };
      }
      return { success: true, updatedAt };
    } catch (err) {
      return { success: false, error: err.message, offline: true };
    }
  }

  // ==========================================
  // CAMPAIGN LOGS TABLE SYNC (Master Audit + Error Logs)
  // ==========================================
  async fetchCampaignLogs(limit = 200) {
    if (!this.isLoggedIn()) return { success: false, error: 'Guest mode active', offline: true, guest: true };
    try {
      const safeLimit = Math.max(1, Math.min(1000, Number(limit) || 200));
      const endpoint = `${this.url}/rest/v1/campaign_logs?user_id=eq.${encodeURIComponent(this.userId)}&order=created_at.desc&limit=${safeLimit}&select=*`;
      const res = await this.requestWithAuthRetry(endpoint, () => ({
        method: 'GET',
        headers: this.getHeaders(),
      }));
      if (!res.ok) {
        return { success: false, error: `HTTP ${res.status}: ${res.statusText}` };
      }
      const rows = await res.json();
      const logs = [];
      const errorLogs = [];
      (rows || []).forEach((row) => {
        const ts = row.created_at ? new Date(row.created_at).getTime() : Date.now();
        if (row.status === 'error') {
          errorLogs.push({
            id: row.client_log_id || row.id,
            module: row.module || 'extension',
            url: row.target_url || '',
            domain: row.domain || '',
            message: row.error || row.content_snippet || 'Error',
            details: row.details || {},
            timestamp: ts,
          });
        } else {
          logs.push({
            id: row.client_log_id || row.id,
            brandId: row.brand_id || undefined,
            module: row.module || 'contact',
            targetUrl: row.target_url || '',
            domain: row.domain || '',
            campaignName: row.campaign_name || 'Default',
            contentSnippet: row.content_snippet || '',
            status: row.status || 'success',
            statusCode: row.status_code ?? (row.status === 'success' ? 200 : 500),
            error: row.error || null,
            details: row.details || {},
            timestamp: ts,
          });
        }
      });
      return { success: true, logs, errorLogs };
    } catch (err) {
      return { success: false, error: err.message, offline: true };
    }
  }

  async upsertCampaignLogs(logs = [], errorLogs = []) {
    if (!this.isLoggedIn()) return { success: true, offline: true, guest: true };
    try {
      const rows = [];
      const seen = new Set();

      (Array.isArray(logs) ? logs : []).slice(0, 200).forEach((l) => {
        if (!l) return;
        const clientId = String(l.id || `log_${l.timestamp || Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
        if (seen.has(clientId)) return;
        seen.add(clientId);
        rows.push({
          user_id: this.userId,
          client_log_id: clientId,
          brand_id: l.brandId || null,
          module: String(l.module || 'contact'),
          target_url: String(l.targetUrl || l.url || l.domain || ''),
          domain: String(l.domain || ''),
          campaign_name: String(l.campaignName || 'Default'),
          content_snippet: String(l.contentSnippet || '').slice(0, 300),
          status: String(l.status || 'success'),
          status_code: Number.isFinite(Number(l.statusCode)) ? Number(l.statusCode) : null,
          error: l.error ? String(l.error).slice(0, 500) : null,
          details: l.details && typeof l.details === 'object' ? l.details : {},
          created_at: l.timestamp ? new Date(l.timestamp).toISOString() : new Date().toISOString(),
        });
      });

      (Array.isArray(errorLogs) ? errorLogs : []).slice(0, 100).forEach((e) => {
        if (!e) return;
        const clientId = String(e.id || `err_${e.timestamp || Date.now()}_${(e.message || '').slice(0, 24)}`);
        if (seen.has(clientId)) return;
        seen.add(clientId);
        rows.push({
          user_id: this.userId,
          client_log_id: clientId,
          brand_id: null,
          module: String(e.module || 'extension'),
          target_url: String(e.url || e.domain || ''),
          domain: String(e.domain || ''),
          campaign_name: '',
          content_snippet: String(e.message || 'Error').slice(0, 300),
          status: 'error',
          status_code: 500,
          error: String(e.message || 'Error').slice(0, 500),
          details: e.details && typeof e.details === 'object' ? e.details : {},
          created_at: e.timestamp ? new Date(e.timestamp).toISOString() : new Date().toISOString(),
        });
      });

      if (rows.length === 0) return { success: true, count: 0 };

      const endpoint = `${this.url}/rest/v1/campaign_logs?on_conflict=user_id,client_log_id`;
      const res = await this.requestWithAuthRetry(endpoint, () => ({
        method: 'POST',
        headers: this.getHeaders(true),
        body: JSON.stringify(rows),
      }));

      if (!res.ok) {
        return { success: false, error: await this.parseErrorDetail(res) };
      }

      return { success: true, count: rows.length };
    } catch (err) {
      return { success: false, error: err.message, offline: true };
    }
  }

  async clearCampaignLogs(statusFilter = null) {
    if (!this.isLoggedIn()) return { success: true, offline: true };
    try {
      const filter = statusFilter ? `&status=eq.${encodeURIComponent(statusFilter)}` : '';
      const endpoint = `${this.url}/rest/v1/campaign_logs?user_id=eq.${encodeURIComponent(this.userId)}${filter}`;
      const res = await this.requestWithAuthRetry(endpoint, () => ({
        method: 'DELETE',
        headers: this.getHeaders(),
      }));
      if (!res.ok) {
        return { success: false, error: `HTTP ${res.status}: ${res.statusText}` };
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message, offline: true };
    }
  }

  // ==========================================
  // SUPABASE STORAGE: BRAND MEDIA ASSETS
  // ==========================================
  async uploadBrandAsset(storagePath, dataUrl) {
    if (!this.isLoggedIn() || !dataUrl || !String(dataUrl).startsWith('data:')) {
      return { success: false, fallbackUrl: dataUrl };
    }
    try {
      const match = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
      if (!match) return { success: false, fallbackUrl: dataUrl };
      const mimeType = match[1] || 'image/png';
      const base64 = match[2];
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      const cleanPath = String(storagePath || `asset-${Date.now()}.png`).replace(/^\/+/, '').replace(/[^a-zA-Z0-9._/-]/g, '_');
      const fullPath = `${this.userId}/${cleanPath}`;
      const endpoint = `${this.url}/storage/v1/object/brand-assets/${fullPath}`;

      const res = await this.requestWithAuthRetry(endpoint, () => ({
        method: 'POST',
        headers: {
          ...this.getHeaders(false, mimeType),
          'x-upsert': 'true',
        },
        body: bytes,
      }));

      if (!res.ok) {
        return { success: false, fallbackUrl: dataUrl, error: `HTTP ${res.status}` };
      }

      return {
        success: true,
        publicUrl: `${this.url}/storage/v1/object/public/brand-assets/${fullPath}`,
      };
    } catch (err) {
      return { success: false, fallbackUrl: dataUrl, error: err.message };
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SupabaseClient;
}
