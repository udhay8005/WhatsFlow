/**
 * @file StatusDistributionChart.jsx
 * @description Donut pie chart showing the distribution of message statuses
 *              (sent, failed, queued, processing). Adapts tooltip and legend
 *              colours for dark and light themes using the useTheme() hook.
 * @module components/charts/StatusDistributionChart
 * @author Udhaya Chandra SA
 * @version 1.0.1
 */

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useTheme } from '../../contexts/ThemeContext';

const COLORS = {
    sent: '#22c55e',        // green-500
    failed: '#ef4444',      // red-500
    queued: '#eab308',      // yellow-500
    processing: '#3b82f6',  // blue-500
    delivered: '#14b8a6',   // teal-500
    read: '#06b6d4',        // cyan-500
};

export default function StatusDistributionChart({ data }) {
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => { setMounted(true); }, []);

    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const tooltipBg     = isDark ? '#1F2937' : '#FFFFFF';
    const tooltipBorder = isDark ? '#374151' : '#E5E7EB';
    const tooltipText   = isDark ? '#F9FAFB' : '#111827';
    const legendColor   = isDark ? '#9CA3AF' : '#6B7280';

    if (!mounted) return <div className="h-64 w-full" />;

    if (!data || data.length === 0) {
        return (
            <div className="h-64 flex items-center justify-center text-gray-400 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
                No data available
            </div>
        );
    }

    const chartData = data.map(item => ({
        name: item.status.charAt(0).toUpperCase() + item.status.slice(1),
        value: item.count,
        color: COLORS[item.status] || '#9ca3af'
    }));

    return (
        <div className="h-64 w-full" style={{ minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%" debounce={50}>
                <PieChart>
                    <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                    >
                        {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                    </Pie>
                    <Tooltip
                        contentStyle={{
                            backgroundColor: tooltipBg,
                            border: `1px solid ${tooltipBorder}`,
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                            color: tooltipText,
                        }}
                    />
                    <Legend
                        verticalAlign="bottom"
                        height={36}
                        iconType="circle"
                        formatter={(value) => (
                            <span style={{ color: legendColor, fontSize: 12 }}>{value}</span>
                        )}
                    />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
}
