/**
 * @file Settings.jsx
 * @description Application settings page. Organises configuration into tabbed
 *              sections: WhatsApp API credentials, SMTP email fallback settings,
 *              and operational controls (rate limit, tunnel status, history/log
 *              clearing, app cleanup). All sensitive values are masked on display.
 * @module pages/Settings
 * @author Udhaya Chandra SA
 * @version 1.0.1
 */

import React, { useEffect, useState } from 'react';
import { Save, CheckCircle, Eye, EyeOff, MessageSquare, Mail, Zap } from 'lucide-react';
import { apiService } from '../services/api';
import { useToast } from '../components/Toast';

export default function Settings() {
    const { addToast } = useToast();
    const [activeTab, setActiveTab] = useState('whatsapp');
    const [formData, setFormData] = useState({
        wa_access_token: '', wa_phone_id: '', wa_waba_id: '', webhook_verify_token: '', wa_app_secret: '',
        smtp_host: '', smtp_port: '', smtp_user: '', smtp_pass: '', smtp_secure: 'false',
        smtp_from_email: '', smtp_from_name: '', email_fallback_subject: '',
        max_tps: '5'
    });
    const [status, setStatus] = useState({});
    const [loading, setLoading] = useState(false);
    const [showSecrets, setShowSecrets] = useState({});
    const [validationErrors, setValidationErrors] = useState({});
    const [tunnelUrl, setTunnelUrl] = useState(null);
    const [tunnelActive, setTunnelActive] = useState(false);
    const [tunnelConnecting, setTunnelConnecting] = useState(false);
    const [tunnelLoading, setTunnelLoading] = useState(false);
    const [tunnelSubdomain, setTunnelSubdomain] = useState('');

    const loadStatus = React.useCallback(async () => {
        try {
            const res = await apiService.getConfigStatus();
            const config = res.data.configured || {};
            setStatus(config);
            // Restore plain-value fields (not secrets) so they show current values
            setFormData(prev => ({
                ...prev,
                max_tps: config.max_tps || '5',
                smtp_from_email: config.smtp_from_email || '',
                smtp_from_name: config.smtp_from_name || '',
                email_fallback_subject: config.email_fallback_subject || ''
            }));
        } catch {
            addToast('Failed to load configuration status', 'error');
        }
    }, [addToast]);

    useEffect(() => {
        loadStatus();
        fetchTunnelUrl();
    }, [loadStatus]);

    const fetchTunnelUrl = async () => {
        try {
            const res = await apiService.getTunnelStatus();
            setTunnelUrl(res.data.url);
            setTunnelActive(res.data.active);
            setTunnelConnecting(res.data.connecting || false);
            // Pre-fill subdomain input with the saved value from the database
            if (res.data.savedSubdomain) {
                setTunnelSubdomain(res.data.savedSubdomain);
            }
        } catch {
            // Tunnel status is optional — silently ignore if not available
        }
    };

    const handleStartTunnel = async () => {
        setTunnelLoading(true);
        try {
            const res = await apiService.startTunnel(tunnelSubdomain.trim() || undefined);
            setTunnelUrl(res.data.url);
            setTunnelActive(true);
            setTunnelConnecting(false);
            if (res.data.subdomain) setTunnelSubdomain(res.data.subdomain);
            addToast('Tunnel started! Your webhook URL is ready.', 'success');
        } catch (err) {
            const msg = err.response?.data?.error || err.message;
            addToast('Failed to start tunnel: ' + msg, 'error');
        } finally {
            setTunnelLoading(false);
        }
    };

    const handleStopTunnel = async () => {
        setTunnelLoading(true);
        try {
            await apiService.stopTunnel();
            setTunnelUrl(null);
            setTunnelActive(false);
            setTunnelConnecting(false);
            addToast('Tunnel stopped.', 'success');
        } catch (err) {
            addToast('Failed to stop tunnel: ' + err.message, 'error');
        } finally {
            setTunnelLoading(false);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        addToast('Copied to clipboard!', 'success');
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });

        // Clear validation error on change
        if (validationErrors[name]) {
            setValidationErrors(prev => ({ ...prev, [name]: null }));
        }
    };

    const toggleShow = (field) => {
        setShowSecrets(prev => ({ ...prev, [field]: !prev[field] }));
    };

    const validateForm = () => {
        const errors = {};

        if (activeTab === 'whatsapp') {
            if (formData.wa_phone_id && !/^\d{10,20}$/.test(formData.wa_phone_id)) {
                errors.wa_phone_id = 'Phone ID should be 10-20 digits';
            }
            if (formData.wa_waba_id && !/^\d{10,20}$/.test(formData.wa_waba_id)) {
                errors.wa_waba_id = 'WABA ID should be 10-20 digits';
            }
        } else {
            if (formData.smtp_host && !/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(formData.smtp_host)) {
                errors.smtp_host = 'Invalid SMTP host format';
            }
            if (formData.smtp_port && (isNaN(formData.smtp_port) || formData.smtp_port < 1 || formData.smtp_port > 65535)) {
                errors.smtp_port = 'Port must be between 1-65535';
            }
            if (formData.smtp_user && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.smtp_user)) {
                errors.smtp_user = 'Invalid email format';
            }
        }

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            addToast('Please fix validation errors', 'error');
            return;
        }

        setLoading(true);

        // Filter data based on active tab
        const payload = {};
        if (activeTab === 'whatsapp') {
            ['wa_access_token', 'wa_phone_id', 'wa_waba_id', 'webhook_verify_token', 'wa_app_secret', 'max_tps'].forEach(k => {
                if (formData[k]) payload[k] = formData[k];
            });
        } else {
            ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_secure',
             'smtp_from_email', 'smtp_from_name', 'email_fallback_subject'].forEach(k => {
                if (formData[k] !== undefined) payload[k] = formData[k];
            });
        }

        try {
            await apiService.saveConfig(payload);
            addToast('Configuration saved successfully!', 'success');

            // Clear inputs
            const cleared = { ...formData };
            Object.keys(payload).forEach(k => cleared[k] = '');
            setFormData(cleared);
            loadStatus();
        } catch (err) {
            const errorMsg = err.response?.data?.error || err.message;
            addToast('Failed to save: ' + errorMsg, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <header>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h2>
                <p className="text-gray-600 dark:text-gray-400">Manage application configuration.</p>
            </header>

            {/* Tabs */}
            <div className="flex gap-4 border-b border-gray-200 dark:border-gray-700">
                <button
                    onClick={() => setActiveTab('whatsapp')}
                    className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium transition-colors ${activeTab === 'whatsapp' ? 'border-green-500 text-green-600 dark:text-green-400' : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                >
                    <MessageSquare size={18} /> WhatsApp API
                </button>
                <button
                    onClick={() => setActiveTab('email')}
                    className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium transition-colors ${activeTab === 'email' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                >
                    <Mail size={18} /> Email Fallback
                </button>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <form onSubmit={handleSubmit} className="space-y-4">

                    {/* WhatsApp Form */}
                    {activeTab === 'whatsapp' && (
                        <>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Credentials from Meta for Developers (WhatsApp Product).</p>
                            <InputField
                                label="Phone Number ID"
                                name="wa_phone_id"
                                value={formData.wa_phone_id}
                                onChange={handleChange}
                                configured={status.wa_phone_id}
                                placeholder="e.g., 105551234567890"
                                error={validationErrors.wa_phone_id}
                            />
                            <InputField
                                label="WABA ID (Business Account ID)"
                                name="wa_waba_id"
                                value={formData.wa_waba_id}
                                onChange={handleChange}
                                configured={status.wa_waba_id}
                                placeholder="e.g., 209991234567890"
                                error={validationErrors.wa_waba_id}
                            />
                            <SecretField
                                label="Permanent Access Token"
                                name="wa_access_token"
                                value={formData.wa_access_token}
                                onChange={handleChange}
                                show={showSecrets.wa_access_token}
                                onToggle={() => toggleShow('wa_access_token')}
                                configured={status.wa_access_token}
                            />



                            <hr className="border-gray-200 dark:border-gray-700 my-4" />
                            <div className="bg-blue-50 dark:bg-gray-900/50 p-4 rounded-lg border border-blue-100 dark:border-gray-700">
                                <h4 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                                    <Zap size={18} className="text-yellow-500" /> Sending Speed
                                </h4>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                                    Controls how fast messages are sent. Default is 1 message/sec.
                                    <br />⚠️ Higher speeds require a rigorous WhatsApp Quality Score.
                                </p>

                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm font-medium">
                                        <span className="text-gray-700 dark:text-gray-300">Target Speed</span>
                                        <span className="text-blue-600 dark:text-blue-400">{formData.max_tps || 5} msg/sec</span>
                                    </div>
                                    <input
                                        type="range"
                                        name="max_tps"
                                        min="1"
                                        max="100"
                                        step="1"
                                        value={formData.max_tps || 5}
                                        onChange={handleChange}
                                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-blue-600"
                                    />
                                    <div className="flex justify-between text-xs text-gray-500">
                                        <span>Safe (1/s)</span>
                                        <span>Fast (50/s)</span>
                                        <span>Turbo (100/s)</span>
                                    </div>
                                </div>
                            </div>

                            <SecretField
                                label="App Secret"
                                name="wa_app_secret"
                                value={formData.wa_app_secret}
                                onChange={handleChange}
                                show={showSecrets.wa_app_secret}
                                onToggle={() => toggleShow('wa_app_secret')}
                                configured={status.wa_app_secret}
                            />

                            <hr className="border-gray-200 dark:border-gray-700 my-4" />
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Webhook Verification (Must match value in Meta Dashboard)</p>
                            <SecretField
                                label="Verify Token"
                                name="webhook_verify_token"
                                value={formData.webhook_verify_token}
                                onChange={handleChange}
                                show={showSecrets.webhook_verify_token}
                                onToggle={() => toggleShow('webhook_verify_token')}
                                configured={status.webhook_verify_token}
                            />
                        </>
                    )}

                    {/* Email Form */}
                    {activeTab === 'email' && (
                        <>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">SMTP Server details to send emails when WhatsApp delivery fails.</p>
                            <div className="grid grid-cols-2 gap-4">
                                <InputField
                                    label="SMTP Host"
                                    name="smtp_host"
                                    value={formData.smtp_host}
                                    onChange={handleChange}
                                    configured={status.smtp_host}
                                    placeholder="e.g., smtp.gmail.com"
                                    error={validationErrors.smtp_host}
                                />
                                <InputField
                                    label="SMTP Port"
                                    name="smtp_port"
                                    value={formData.smtp_port}
                                    onChange={handleChange}
                                    configured={status.smtp_port}
                                    placeholder="e.g., 587 or 465"
                                    error={validationErrors.smtp_port}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <InputField
                                    label="Username / Email"
                                    name="smtp_user"
                                    value={formData.smtp_user}
                                    onChange={handleChange}
                                    configured={status.smtp_user}
                                    placeholder="user@example.com"
                                    error={validationErrors.smtp_user}
                                />
                                <div className="space-y-1">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Encryption (SSL/TLS)</label>
                                    <select
                                        name="smtp_secure"
                                        value={formData.smtp_secure}
                                        onChange={handleChange}
                                        className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-gray-900 dark:text-white h-[42px] focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                    >
                                        <option value="false">STARTTLS (Port 587)</option>
                                        <option value="true">SSL (Port 465)</option>
                                    </select>
                                </div>
                            </div>
                            <SecretField
                                label="Password / App Password"
                                name="smtp_pass"
                                value={formData.smtp_pass}
                                onChange={handleChange}
                                show={showSecrets.smtp_pass}
                                onToggle={() => toggleShow('smtp_pass')}
                                configured={status.smtp_pass}
                            />

                            {/* Sender identity */}
                            <div className="grid grid-cols-2 gap-4">
                                <InputField
                                    label="From Email Address"
                                    name="smtp_from_email"
                                    value={formData.smtp_from_email}
                                    onChange={handleChange}
                                    placeholder="noreply@yourdomain.com"
                                />
                                <InputField
                                    label="From Name (Sender Display Name)"
                                    name="smtp_from_name"
                                    value={formData.smtp_from_name}
                                    onChange={handleChange}
                                    placeholder="WhatsFlow Bot"
                                />
                            </div>

                            {/* Fallback email subject */}
                            <div className="rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 p-4">
                                <h4 className="text-sm font-semibold text-orange-900 dark:text-orange-200 mb-1 flex items-center gap-2">
                                    ✉️ Fallback Email Subject
                                </h4>
                                <p className="text-xs text-orange-700 dark:text-orange-300 mb-3">
                                    This subject line is used when WhatsApp delivery fails and the message is sent via email instead.
                                    Leave blank to use the default: <em>"Important Message"</em>.
                                </p>
                                <input
                                    type="text"
                                    name="email_fallback_subject"
                                    value={formData.email_fallback_subject}
                                    onChange={handleChange}
                                    placeholder="Important Message"
                                    maxLength={150}
                                    className="w-full bg-white dark:bg-gray-900 border border-orange-300 dark:border-orange-700 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-sm"
                                />
                                <p className="text-xs text-gray-400 mt-1 text-right">
                                    {formData.email_fallback_subject.length}/150
                                </p>
                            </div>

                            {/* Test SMTP Connection */}
                            {formData.smtp_host && formData.smtp_user && formData.smtp_pass && (
                                <div className="pt-2">
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            try {
                                                const res = await apiService.testSmtp({
                                                    smtp_host: formData.smtp_host,
                                                    smtp_port: formData.smtp_port || '587',
                                                    smtp_user: formData.smtp_user,
                                                    smtp_pass: formData.smtp_pass,
                                                    smtp_secure: formData.smtp_secure
                                                });
                                                addToast(res.data.message || 'SMTP connection successful!', 'success');
                                            } catch (err) {
                                                const msg = err.response?.data?.error || err.message;
                                                addToast(msg, 'error');
                                            }
                                        }}
                                        className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                                    >
                                        Test SMTP Connection
                                    </button>
                                </div>
                            )}
                        </>
                    )}

                    <div className="pt-4 flex justify-end">
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                            <Save size={18} />
                            {loading ? 'Saving...' : 'Save Configuration'}
                        </button>
                    </div>
                </form>
            </div>

            {activeTab === 'whatsapp' && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                        🔗 Webhook Configuration
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
                        Meta needs a public HTTPS URL to send delivery receipts and inbound message events. Start the tunnel to get your URL instantly, or enter your own domain.
                    </p>

                    {/* Subdomain Input */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Tunnel Subdomain
                            <span className="ml-1 font-normal text-gray-400">(leave blank for a random URL each time)</span>
                        </label>
                        <div className="flex items-center gap-1">
                            <span className="text-sm text-gray-400 dark:text-gray-500 shrink-0">https://</span>
                            <input
                                type="text"
                                value={tunnelSubdomain}
                                onChange={e => setTunnelSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                placeholder="yourname-whatsflow"
                                disabled={tunnelActive}
                                className="flex-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                            <span className="text-sm text-gray-400 dark:text-gray-500 shrink-0">.loca.lt/webhook</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                            Set a unique name to always get the same URL. Saved automatically when you start the tunnel.
                        </p>
                    </div>

                    {/* Tunnel Status Card */}
                    <div className={`rounded-lg border p-4 mb-4 ${
                        tunnelActive
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                            : tunnelConnecting
                                ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                                : 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700'
                    }`}>
                        <div className="flex items-center justify-between flex-wrap gap-3">
                            <div className="flex items-center gap-3">
                                <span className={`text-2xl ${tunnelActive ? '' : tunnelConnecting ? '' : 'opacity-40'}`}>
                                    {tunnelActive ? '✅' : tunnelConnecting ? '⏳' : '🔌'}
                                </span>
                                <div>
                                    <p className={`font-semibold text-sm ${
                                        tunnelActive ? 'text-green-800 dark:text-green-200'
                                            : tunnelConnecting ? 'text-yellow-800 dark:text-yellow-200'
                                                : 'text-gray-600 dark:text-gray-400'
                                    }`}>
                                        {tunnelActive ? 'Tunnel Active — Webhook Ready'
                                            : tunnelConnecting ? 'Connecting tunnel…'
                                                : 'Tunnel Not Running'}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                        {tunnelActive
                                            ? 'LocalTunnel is forwarding Meta webhook events to your local server.'
                                            : tunnelConnecting
                                                ? 'Please wait while the tunnel establishes a connection.'
                                                : 'Click "Start Tunnel" to expose your local server to the internet.'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                {!tunnelActive && (
                                    <button
                                        type="button"
                                        onClick={handleStartTunnel}
                                        disabled={tunnelLoading || tunnelConnecting}
                                        className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                    >
                                        {tunnelLoading ? (
                                            <><span className="animate-spin">⟳</span> Starting…</>
                                        ) : '▶ Start Tunnel'}
                                    </button>
                                )}
                                {tunnelActive && (
                                    <button
                                        type="button"
                                        onClick={handleStopTunnel}
                                        disabled={tunnelLoading}
                                        className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                    >
                                        {tunnelLoading ? (
                                            <><span className="animate-spin">⟳</span> Stopping…</>
                                        ) : '⏹ Stop Tunnel'}
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={fetchTunnelUrl}
                                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm transition-colors"
                                    title="Refresh tunnel status"
                                >
                                    ↻ Refresh
                                </button>
                            </div>
                        </div>

                        {/* Webhook URL */}
                        {tunnelUrl && (
                            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wide">
                                    Your Webhook URL — Paste this into Meta App Dashboard → Webhooks
                                </p>
                                <div className="flex items-center gap-2">
                                    <code className={`flex-1 px-3 py-2 rounded text-sm font-mono break-all ${
                                        tunnelActive
                                            ? 'bg-green-100 dark:bg-green-900/40 text-green-900 dark:text-green-100'
                                            : 'bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300'
                                    }`}>
                                        {tunnelUrl}
                                    </code>
                                    <button
                                        type="button"
                                        onClick={() => copyToClipboard(tunnelUrl)}
                                        className="shrink-0 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium transition-colors"
                                    >
                                        Copy
                                    </button>
                                </div>
                                <p className="text-xs text-gray-400 mt-1">
                                    Use the <strong>Verify Token</strong> field above when Meta asks to verify this URL.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Setup Guide */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-4 text-sm text-blue-900 dark:text-blue-200">
                        <p className="font-semibold mb-2">📋 Quick Setup Guide</p>
                        <ol className="list-decimal list-inside space-y-1 text-xs text-blue-800 dark:text-blue-300">
                            <li>Save your <strong>Verify Token</strong> in the form above.</li>
                            <li>Click <strong>Start Tunnel</strong> — copy the webhook URL shown.</li>
                            <li>Go to <strong>Meta App Dashboard → WhatsApp → Configuration → Webhooks</strong>.</li>
                            <li>Paste the URL and enter your Verify Token, then click <strong>Verify &amp; Save</strong>.</li>
                            <li>Subscribe to the <strong>messages</strong> field under Webhook Fields.</li>
                        </ol>
                    </div>
                </div>
            )}

            {/* Maintenance Section */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 mt-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">🛠️ Maintenance</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Clean up logs and temporary files
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Clear Logs Button */}
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 dark:text-white mb-2">Clear Logs</h4>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                            Delete all log files to free up space
                        </p>
                        <button
                            onClick={async () => {
                                if (!confirm('Are you sure you want to clear all log files?')) return;
                                try {
                                    const res = await apiService.clearLogs();
                                    addToast(res.data.message || 'Logs cleared successfully', 'success');
                                } catch {
                                    addToast('Failed to clear logs', 'error');
                                }
                            }}
                            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium"
                        >
                            Clear Logs
                        </button>
                    </div>

                    {/* Clean App Button */}
                    <div className="border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                        <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-2">Clean App</h4>
                        <p className="text-xs text-blue-600 dark:text-blue-400 mb-3">
                            Clear logs, temp files, and optimize database
                        </p>
                        <button
                            onClick={async () => {
                                if (!confirm('Clean app data? This will:\n- Clear all logs\n- Remove temporary files\n- Optimize database')) return;
                                try {
                                    const res = await apiService.cleanApp();
                                    addToast(res.data.message || 'App cleaned successfully', 'success');
                                } catch {
                                    addToast('Failed to clean app', 'error');
                                }
                            }}
                            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium"
                        >
                            Clean App
                        </button>
                    </div>
                </div>

                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
                    <p className="text-xs text-blue-800 dark:text-blue-200">
                        💡 To delete individual campaigns/messages, go to the History page
                    </p>
                </div>
            </div>
        </div>
    );
}

function InputField({ label, name, type = "text", value, onChange, configured, placeholder, error }) {
    return (
        <div>
            <div className="flex justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
                {configured && <span className="text-xs text-green-400 flex items-center gap-1"><CheckCircle size={12} /> Configured</span>}
            </div>
            <input
                type={type}
                name={name}
                value={value}
                onChange={onChange}
                placeholder={configured ? '(Hidden for Security)' : placeholder}
                className={`w-full bg-white dark:bg-gray-900 border rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:border-transparent outline-none ${error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 dark:border-gray-600 focus:ring-green-500'
                    }`}
            />
            {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
        </div>
    );
}

function SecretField({ label, name, value, onChange, show, onToggle, configured }) {
    return (
        <div>
            <div className="flex justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
                {configured && <span className="text-xs text-green-400 flex items-center gap-1"><CheckCircle size={12} /> Configured</span>}
            </div>
            <div className="relative">
                <input
                    type={show ? "text" : "password"}
                    name={name}
                    value={value}
                    onChange={onChange}
                    placeholder={configured ? '(Hidden for Security)' : '••••••••'}
                    className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                />
                <button
                    type="button"
                    onClick={onToggle}
                    className="absolute right-3 top-2.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white"
                >
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
            </div>
        </div>
    );
}
