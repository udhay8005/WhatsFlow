/**
 * @file api.ts
 * @description Centralised Axios API client for WhatsFlow frontend.
 *              Obtains a session API key from /auth/token on first request and
 *              attaches it as X-API-Key to every subsequent request. Handles
 *              timeout, network errors, and 403 key-expiry retries via interceptors.
 * @module services/api
 * @author Udhaya Chandra SA
 * @version 1.0.1
 */

import axios, { AxiosInstance, AxiosError, AxiosResponse } from 'axios';

// Interfaces for API Responses
export interface Template {
    name: string;
    language: string;
    status: string;
    category?: string;
    components?: any[];
}

export interface Campaign {
    id: number;
    name: string;
    template_name: string;
    status: 'draft' | 'active' | 'paused' | 'completed' | 'processing';
    total_count: number;
    success_count: number;
    failed_count: number;
    scheduled_at?: string;
    created_at: string;
}

export interface CreateCampaignPayload {
    name: string;
    templateName: string;
    contacts: Array<{
        phone: string;
        email?: string;
        params?: any[];
    }>;
    mediaId?: string | null;
    mediaType?: string | null;
    scheduledAt?: string | null;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const api: AxiosInstance = axios.create({
    baseURL: API_URL,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Fetch API key from local auth endpoint on startup
let apiKeyPromise: Promise<string> | null = null;

function fetchApiKey(): Promise<string> {
    if (!apiKeyPromise) {
        apiKeyPromise = axios.get(`${API_URL}/auth/token`)
            .then(res => res.data.apiKey)
            .catch(err => {
                console.error('[API] Failed to fetch API key:', err.message);
                apiKeyPromise = null; // Allow retry
                return '';
            });
    }
    return apiKeyPromise;
}

// Add request interceptor to attach API key
api.interceptors.request.use(async (config) => {
    const key = await fetchApiKey();
    if (key) {
        config.headers['X-API-Key'] = key;
    }
    return config;
});

// Add response interceptor for global error handling
api.interceptors.response.use(
    (response: AxiosResponse) => response,
    (error: AxiosError) => {
        if (error.code === 'ECONNABORTED') {
            console.error('[API] Request timeout');
            error.message = 'Request timed out. Please check your connection.';
        } else if (!error.response) {
            console.error('[API] Network error:', error.message);
            error.message = 'Cannot connect to server. Please ensure the backend is running.';
        } else if (error.response.status === 403) {
            // Only force a key re-fetch for API routes — never for /auth/token
            // itself, which would create an infinite retry loop.
            const url = (error.config as any)?.url || '';
            if (!url.includes('/auth/token')) {
                console.error('[API] Auth error — retrying key fetch');
                apiKeyPromise = null; // Force re-fetch on next request
            }
        } else if (error.response.status >= 500) {
            console.error('[API] Server error:', error.response.data);
            error.message = 'Server error. Please try again later.';
        }
        return Promise.reject(error);
    }
);

export const apiService = {
    // Health
    checkHealth: () => api.get('/health'),

    // Settings
    getConfigStatus: () => api.get('/api/settings/config'),
    saveConfig: (data: any) => api.post('/api/settings/config', data),
    getTemplates: () => api.get<{ data: Template[] }>('/api/campaigns/templates'),

    // Campaigns
    getCampaigns: () => api.get<Campaign[]>('/api/campaigns'),
    getCampaignDetails: (id: string | number) => api.get<Campaign & { messages: any[] }>(`/api/campaigns/${id}`),
    createCampaign: (data: CreateCampaignPayload) => api.post('/api/campaigns', data),
    updateCampaign: (id: string | number, data: Partial<CreateCampaignPayload> & { status?: string }) => api.put(`/api/campaigns/${id}`, data),
    pauseCampaign: (id: string | number) => api.post(`/api/campaigns/${id}/pause`),
    resumeCampaign: (id: string | number) => api.post(`/api/campaigns/${id}/resume`),
    deleteCampaign: (id: string | number) => api.delete(`/api/campaigns/${id}`),

    // Contact Safety
    checkEligibility: (contacts: any[]) => api.post('/api/contacts/check-eligibility', { contacts }),
    getBlacklist: () => api.get('/api/contacts/blacklist'),
    addToBlacklist: (phone: string, reason: string) => api.post('/api/contacts/blacklist', { phone, reason }),
    removeFromBlacklist: (phone: string) => api.delete(`/api/contacts/blacklist/${encodeURIComponent(phone)}`),

    // Media
    uploadMedia: (formData: FormData) => api.post<{ mediaId: string, mediaType: string }>('/api/media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),

    // Stats
    getStatsDashboard: () => api.get('/api/stats/dashboard'),
    getStatsTrend: () => api.get('/api/stats/trend'),
    getStatsDistribution: () => api.get('/api/stats/status-distribution'),

    // SMTP Test
    testSmtp: (data: { smtp_host: string; smtp_port: string; smtp_user: string; smtp_pass: string; smtp_secure: string }) =>
        api.post('/api/settings/test-smtp', data),

    // Maintenance
    getTunnelStatus: () => api.get('/api/settings/tunnel'),
    startTunnel: () => api.post('/api/settings/tunnel/start'),
    stopTunnel: () => api.post('/api/settings/tunnel/stop'),
    clearLogs: () => api.post('/api/settings/clear-logs'),
    cleanApp: () => api.post('/api/settings/clean-app'),
    clearHistory: () => api.post('/api/settings/clear-history')
};

export default api;
