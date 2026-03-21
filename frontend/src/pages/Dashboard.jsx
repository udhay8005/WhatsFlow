import React, { useEffect, useState } from 'react';
import { Activity, Send, Users, AlertTriangle, Plus, Pause, Play, TrendingUp, Edit } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { apiService } from '../services/api';
import { io } from 'socket.io-client';
import DeliveryTrendChart from '../components/charts/DeliveryTrendChart';
import StatusDistributionChart from '../components/charts/StatusDistributionChart';

export default function Dashboard() {
    const [stats, setStats] = useState({ campaigns: 0, sent: 0, failed: 0 });
    const [recent, setRecent] = useState([]);
    const [trendData, setTrendData] = useState([]);
    const [distData, setDistData] = useState([]);

    useEffect(() => {
        loadData();

        // Connect to Socket.IO
        const socket = io('http://localhost:3000');

        socket.on('campaign_progress', (data) => {
            // ... existing socket logic
            loadData(); // Reload trend data on progress
            setRecent(prev => prev.map(c => {
                if (c.id === data.id) {
                    return {
                        ...c,
                        success_count: data.type === 'success' ? (c.success_count || 0) + 1 : c.success_count,
                        failed_count: data.type === 'failed' ? (c.failed_count || 0) + 1 : c.failed_count
                    };
                }
                return c;
            }));

            // Optional: Update global stats if needed, but reloading might be safer or just increment
            setStats(prev => ({
                ...prev,
                sent: data.type === 'success' ? prev.sent + 1 : prev.sent,
                failed: data.type === 'failed' ? prev.failed + 1 : prev.failed
            }));
        });

        socket.on('status_update', (data) => {
            // Basic toast or notification could go here
        });

        return () => socket.disconnect();
    }, []);

    const loadData = async () => {
        try {
            const [campaignsRes, trendRes, distRes] = await Promise.all([
                apiService.getCampaigns(),
                apiService.getStatsTrend(),
                apiService.getStatsDistribution()
            ]);

            const list = campaignsRes.data;
            setRecent(list.slice(0, 50));
            setTrendData(trendRes.data);
            setDistData(distRes.data);

            // Calculate aggregate stats locally
            const totalSent = list.reduce((n, c) => n + (c.success_count || 0), 0);
            const totalFailed = list.reduce((n, c) => n + (c.failed_count || 0), 0);

            setStats({
                campaigns: list.length,
                sent: totalSent,
                failed: totalFailed
            });
        } catch (err) {
            console.error(err);
        }
    };

    const handleToggleStatus = async (id, action) => {
        try {
            if (action === 'pause') await apiService.pauseCampaign(id);
            else await apiService.resumeCampaign(id);
            loadData(); // Refresh list
        } catch (err) {
            console.error("Failed to toggle status", err);
        }
    };

    return (
        <div className="space-y-6">
            <header className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h2>
                    <p className="text-gray-600 dark:text-gray-400">Overview of your messaging activity.</p>
                </div>
                <NavLink to="/campaigns/new" className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium">
                    <Plus size={18} /> New Campaign
                </NavLink>
            </header>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <TrendingUp className="text-green-600 dark:text-green-400" size={20} />
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Delivery Trend (Last 7 Days)</h3>
                    </div>
                    <DeliveryTrendChart data={trendData} />
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        {/* We use TrendingUp as placeholder icon if PieChart icon not imported, but let's assume it is or reuse */}
                        <TrendingUp className="text-blue-600 dark:text-blue-400" size={20} />
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Messages Status</h3>
                    </div>
                    <StatusDistributionChart data={distData} />
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard icon={<Activity />} label="Total Campaigns" value={stats.campaigns} color="blue" />
                <StatCard icon={<Send />} label="Messages Sent" value={stats.sent} color="green" />
                <StatCard icon={<AlertTriangle />} label="Failures" value={stats.failed} color="red" />
            </div>

            {/* Recent Campaigns */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="font-semibold text-gray-900 dark:text-white">Recent Activity</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600 dark:text-gray-400">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 uppercase text-xs font-medium">
                            <tr>
                                <th className="px-6 py-3">Campaign Name</th>
                                <th className="px-6 py-3">Template</th>
                                <th className="px-6 py-3">Status</th>
                                <th className="px-6 py-3">Controls</th>
                                <th className="px-6 py-3">Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {recent.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-8 text-center text-gray-500">
                                        No campaigns yet. Start your first one!
                                    </td>
                                </tr>
                            ) : (
                                recent.map(c => (
                                    <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                                            {c.name}
                                            {c.scheduled_at && new Date(c.scheduled_at) > new Date() && (
                                                <span className="ml-2 px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                                                    Scheduled
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">{c.template_name}</td>
                                        <td className="px-6 py-4">
                                            <StatusBadge status={c.status} />
                                        </td>
                                        <td className="px-6 py-4 text-gray-500">
                                            <div className="flex gap-2">
                                                {c.status === 'active' && (
                                                    <button
                                                        onClick={() => handleToggleStatus(c.id, 'pause')}
                                                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-gray-600 dark:text-gray-300"
                                                        title="Pause Campaign"
                                                    >
                                                        <Pause size={16} />
                                                    </button>
                                                )}
                                                {c.status === 'paused' && (
                                                    <button
                                                        onClick={() => handleToggleStatus(c.id, 'resume')}
                                                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-green-600 dark:text-green-400"
                                                        title="Resume Campaign"
                                                    >
                                                        <Play size={16} />
                                                    </button>
                                                )}
                                                {c.status === 'draft' && (
                                                    <NavLink
                                                        to={`/campaigns/${c.id}/edit`}
                                                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-blue-600 dark:text-blue-400"
                                                        title="Resume Draft"
                                                    >
                                                        <Edit size={16} />
                                                    </NavLink>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">{new Date(c.created_at).toLocaleDateString()}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function StatCard({ icon, label, value, color }) {
    const colors = {
        blue: 'bg-blue-500/10 text-blue-400',
        green: 'bg-green-500/10 text-green-400',
        red: 'bg-red-500/10 text-red-400',
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center gap-4 shadow-sm">
            <div className={`p-3 rounded-lg ${colors[color]}`}>
                {React.cloneElement(icon, { size: 24 })}
            </div>
            <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
            </div>
        </div>
    );
}

function StatusBadge({ status }) {
    const styles = {
        draft: 'bg-gray-700 text-gray-300',
        processing: 'bg-blue-900 text-blue-300',
        completed: 'bg-green-900 text-green-300',
        failed: 'bg-red-900 text-red-300',
    };
    return (
        <span className={`px-2 py-1 rounded text-xs font-medium uppercase ${styles[status] || styles.draft}`}>
            {status}
        </span>
    );
}
