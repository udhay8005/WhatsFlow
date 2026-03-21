/**
 * @file History.jsx
 * @description Campaign history page. Lists all campaigns with expandable rows
 *              showing per-message delivery details. Supports search filtering,
 *              sort toggling, inline pause/resume/delete controls, and real-time
 *              status updates via Socket.IO.
 * @module pages/History
 * @author Udhaya Chandra SA
 * @version 1.0.0
 */

import React, { useEffect, useState } from 'react';
import { apiService } from '../services/api';
import { RefreshCw, Search, ChevronDown, ChevronUp, Pause, Play, Trash2 } from 'lucide-react';
import { useSocket } from '../contexts/SocketContext';
import { useToast } from '../components/Toast';

export default function History() {
    const { addToast } = useToast();
    const { socket } = useSocket();
    const [campaigns, setCampaigns] = useState([]);
    const [expandedId, setExpandedId] = useState(null);
    const [details, setDetails] = useState({});
    const [loading, setLoading] = useState(false);

    const loadCampaigns = React.useCallback(async (isManual = false) => {
        setLoading(true);
        try {
            const res = await apiService.getCampaigns();
            setCampaigns(res.data);
            if (isManual) addToast('Campaign history updated', 'success');
        } catch (err) {
            addToast('Failed to load campaigns: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [addToast]);

    useEffect(() => {
        loadCampaigns();

        if (!socket) return;

        const onProgress = (data) => {
            setCampaigns(prev => prev.map(c => {
                if (c.id === data.id) {
                    return {
                        ...c,
                        success_count: data.type === 'success' ? (c.success_count || 0) + 1 : c.success_count,
                        failed_count: data.type === 'failed' ? (c.failed_count || 0) + 1 : c.failed_count
                    };
                }
                return c;
            }));
        };

        socket.on('campaign_progress', onProgress);

        return () => {
            socket.off('campaign_progress', onProgress);
        };
    }, [loadCampaigns, socket]);

    const handleToggleStatus = async (e, id, action) => {
        e.stopPropagation(); // Prevent expansion
        try {
            if (action === 'pause') await apiService.pauseCampaign(id);
            else await apiService.resumeCampaign(id);
            loadCampaigns();
        } catch (err) {
            addToast('Failed to update campaign status', 'error');
        }
    };

    const handleDelete = async (e, id, name) => {
        e.stopPropagation(); // Prevent expansion
        if (!confirm(`Delete campaign "${name}"?\n\nThis will delete the campaign and all its messages. This action cannot be undone.`)) return;
        try {
            await apiService.deleteCampaign(id);
            addToast('Campaign deleted successfully', 'success');
            loadCampaigns();
        } catch (err) {
            addToast('Failed to delete campaign: ' + err.message, 'error');
        }
    };

    const toggleExpand = async (id) => {
        if (expandedId === id) {
            setExpandedId(null);
            return;
        }

        setExpandedId(id);
        if (!details[id]) {
            try {
                const res = await apiService.getCampaignDetails(id);
                setDetails(prev => ({ ...prev, [id]: res.data.messages }));
            } catch (err) {
                addToast('Failed to load campaign details', 'error');
            }
        }
    };

    return (
        <div className="space-y-6">
            <header className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Campaign History</h2>
                    <p className="text-gray-600 dark:text-gray-400">View performance and delivery logs.</p>
                </div>
                <button
                    onClick={() => loadCampaigns(true)}
                    className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg transition-colors"
                    title="Refresh History"
                >
                    <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
                </button>
            </header>

            <div className="space-y-4">
                {campaigns.length === 0 && !loading && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center shadow-sm">
                        <p className="text-4xl mb-4">📋</p>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No campaigns yet</h3>
                        <p className="text-gray-500 dark:text-gray-400 text-sm">Create your first campaign to see delivery history here.</p>
                    </div>
                )}
                {campaigns.map(c => (
                    <div key={c.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                        {/* Header Row */}
                        <div
                            className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                            onClick={() => toggleExpand(c.id)}
                        >
                            <div className="flex-1">
                                <div className="flex items-center gap-3">
                                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">{c.name}</h3>
                                    <StatusBadge status={c.status} />
                                    {c.scheduled_at && new Date(c.scheduled_at) > new Date() && (
                                        <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                                            Scheduled
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-gray-400 mt-1">
                                    {new Date(c.created_at).toLocaleString()} • Template: <span className="text-gray-600 dark:text-gray-300">{c.template_name}</span>
                                </p>

                                {/* Progress Bar */}
                                {(c.status === 'active' || c.status === 'paused' || c.status === 'processing') && (
                                    <div className="w-full max-w-sm bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-2">
                                        <div
                                            className="bg-green-500 h-1.5 rounded-full transition-all duration-500"
                                            style={{ width: `${Math.min(100, ((c.success_count || 0) + (c.failed_count || 0)) / (c.total_count || 1) * 100)}%` }}
                                        ></div>
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-6">
                                {/* Controls */}
                                <div className="flex gap-2">
                                    {c.status === 'active' && (
                                        <button
                                            onClick={(e) => handleToggleStatus(e, c.id, 'pause')}
                                            className="p-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full text-gray-600 dark:text-gray-300 transition-colors"
                                            title="Pause Campaign"
                                        >
                                            <Pause size={16} />
                                        </button>
                                    )}
                                    {c.status === 'paused' && (
                                        <button
                                            onClick={(e) => handleToggleStatus(e, c.id, 'resume')}
                                            className="p-2 bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 rounded-full text-green-600 dark:text-green-400 transition-colors"
                                            title="Resume Campaign"
                                        >
                                            <Play size={16} />
                                        </button>
                                    )}
                                    {/* Delete Button */}
                                    <button
                                        onClick={(e) => handleDelete(e, c.id, c.campaign_name)}
                                        className="p-2 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 rounded-full text-red-600 dark:text-red-400 transition-colors"
                                        title="Delete Campaign"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>

                                <div className="text-right">
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white px-5">{c.total_count}</p>
                                    <p className="text-xs text-gray-500 uppercase">Messages</p>
                                </div>
                                <div className={`p-1 rounded-full ${expandedId === c.id ? 'bg-gray-100 dark:bg-gray-700' : ''}`}>
                                    {expandedId === c.id ? <ChevronUp className="text-gray-600 dark:text-gray-300" /> : <ChevronDown className="text-gray-600 dark:text-gray-300" />}
                                </div>
                            </div>
                        </div>

                        {/* Expanded Details */}
                        {expandedId === c.id && (
                            <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 p-4">
                                {details[c.id] ? (
                                    <table className="w-full text-left text-sm text-gray-600 dark:text-gray-400">
                                        <thead className="text-xs uppercase font-medium border-b border-gray-200 dark:border-gray-700 text-gray-500">
                                            <tr>
                                                <th className="px-4 py-2">Phone</th>
                                                <th className="px-4 py-2">Status</th>
                                                <th className="px-4 py-2">Channel</th>
                                                <th className="px-4 py-2">Info</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                                            {details[c.id].map(m => (
                                                <tr key={m.id}>
                                                    <td className="px-4 py-3">{m.phone_number}</td>
                                                    <td className="px-4 py-3">
                                                        <StatusBadge status={m.status} />
                                                    </td>
                                                    <td className="px-4 py-3 capitalize">{m.final_channel || 'whatsapp'}</td>
                                                    <td className="px-4 py-3 text-red-400 text-xs max-w-xs truncate">{m.error_reason}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="flex justify-center p-4">
                                        <RefreshCw className="animate-spin text-gray-500" />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

function StatusBadge({ status }) {
    const styles = {
        draft: 'bg-gray-700 text-gray-300',
        active: 'bg-green-900 text-green-300',
        paused: 'bg-yellow-900 text-yellow-300',
        completed: 'bg-teal-900 text-teal-300',
        processing: 'bg-blue-900 text-blue-300',
        queued: 'bg-gray-800 text-gray-400',
        sent: 'bg-green-900 text-green-300',
        delivered: 'bg-teal-900 text-teal-300',
        read: 'bg-cyan-900 text-cyan-300',
        failed: 'bg-red-900 text-red-300',
    };
    return (
        <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${styles[status] || 'bg-gray-700 text-gray-300'}`}>
            {status}
        </span>
    );
}
