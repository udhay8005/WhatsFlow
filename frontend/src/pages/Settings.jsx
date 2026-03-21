/**
 * @file Settings.jsx
 * @description Application settings page. Organises configuration into tabbed
 *              sections: WhatsApp API credentials, SMTP email fallback settings,
 *              and operational controls (rate limit, tunnel status, history/log
 *              clearing, app cleanup). All sensitive values are masked on display.
 * @module pages/Settings
 * @author Udhaya Chandra SA
 * @version 1.0.0
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
        max_tps: '1'
    });
    const [status, setStatus] = useState({});
    const [loading, setLoading] = useState(false);
    const [showSecrets, setShowSecrets] = useState({});
    const [validationErrors, setValidationErrors] = useState({});
    const [tunnelUrl, setTunnelUrl] = useState(null);
    const [tunnelActive, setTunnelActive] = useState(false);

    const loadStatus = React.useCallback(async () => {
        try {
            const res = await apiService.getConfigStatus();
            const config = res.data.configured || {};
            setStatus(config);
            if (config.max_tps) {
                setFormData(prev => ({ ...prev, max_tps: config.max_tps }));
            }
        } catch (err) {
            console.error(err);
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
        } catch (err) {
            // Tunnel status is optional — silently ignore if not available
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
            ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_secure'].forEach(k => {
                if (formData[k]) payload[k] = formData[k];
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
                                        <span className="text-blue-600 dark:text-blue-400">{formData.max_tps || 1} msg/sec</span>
                                    </div>
                                    <input
                                        type="range"
                                        name="max_tps"
                                        min="1"
                                        max="100"
                                        step="1"
                                        value={formData.max_tps || 1}
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
                <div className={`mt-6 p-4 border rounded-lg ${tunnelActive
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                    }`}>
                    <p className={`text-sm font-semibold mb-2 ${tunnelActive
                        ? 'text-green-800 dark:text-green-200'
                        : 'text-yellow-800 dark:text-yellow-200'
                        }`}>
                        {tunnelActive ? '✅ Public Webhook URL' : '⚠️ Webhook Configuration'}
                    </p>
                    <p className={`text-xs mb-2 ${tunnelActive
                        ? 'text-green-700 dark:text-green-300'
                        : 'text-yellow-700 dark:text-yellow-300'
                        }`}>
                        {tunnelActive
                            ? 'Copy this URL and paste into your Meta App Dashboard:'
                            : 'Start app with tunnel enabled to get your public webhook URL'}
                    </p>
                    {tunnelActive && tunnelUrl ? (
                        <div className="flex items-center gap-2">
                            <code className="flex-1 block bg-green-100 dark:bg-green-900/40 px-3 py-2 rounded text-sm font-mono text-green-900 dark:text-green-100">
                                {tunnelUrl}
                            </code>
                            <button
                                onClick={() => copyToClipboard(tunnelUrl)}
                                className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium"
                            >
                                Copy
                            </button>
                        </div>
                    ) : (
                        <code className="block bg-yellow-100 dark:bg-yellow-900/40 px-3 py-2 rounded text-sm font-mono text-yellow-900 dark:text-yellow-100">
                            Tunnel not active - use "npm run start:prod"
                        </code>
                    )}
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
                                } catch (err) {
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
                                } catch (err) {
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
