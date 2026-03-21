/**
 * @file CampaignReviewStep.jsx
 * @description Step 3 of the campaign wizard. Displays a full review summary —
 *              campaign name, template, contact count, media preview, and
 *              scheduled time — before the user launches or saves as draft.
 * @module components/campaign/CampaignReviewStep
 * @author Udhaya Chandra SA
 * @version 1.0.0
 */

import React, { useState } from 'react';
import { Film, Image, AlertTriangle, Send, Eye, X } from 'lucide-react';

export default function CampaignReviewStep({
    summary, processedContacts,
    mediaPreview, mediaType, mediaFile,
    handleSubmit, loading,
    showConfirm, setShowConfirm,
    isScheduled, setIsScheduled,
    scheduledAt, setScheduledAt,
    onBack,
    selectedTemplate // New Prop
}) {
    const [previewContact, setPreviewContact] = useState(null);

    // Helper to render message
    const renderMessage = (contact) => {
        if (!selectedTemplate) return "Template content not available.";
        const bodyComp = selectedTemplate.components.find(c => c.type === 'BODY');
        let text = bodyComp ? bodyComp.text : '';

        // params is array: ["Val1", "Val2"]
        // Replace {{1}}, {{2}}...
        if (contact.params && Array.isArray(contact.params)) {
            contact.params.forEach((param, idx) => {
                text = text.replace(new RegExp(`{{${idx + 1}}}`, 'g'), param);
            });
        }
        return text;
    };
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-6 rounded-xl text-center">
                    <p className="text-3xl font-bold text-green-700 dark:text-green-400">{summary.valid}</p>
                    <p className="text-green-800 dark:text-green-200">Valid Recipients</p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-6 rounded-xl text-center">
                    <p className="text-3xl font-bold text-red-700 dark:text-red-400">{summary.invalid}</p>
                    <p className="text-red-800 dark:text-red-200">Invalid Rows (Skipped)</p>
                </div>
            </div>

            {mediaPreview && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-600 p-4 rounded-lg flex items-center gap-3">
                    {mediaType === 'video' ? <Film className="text-blue-600 dark:text-blue-400" size={24} /> : <Image className="text-blue-600 dark:text-blue-400" size={24} />}
                    <div>
                        <p className="text-blue-800 dark:text-blue-200 font-medium">Media Attached</p>
                        <p className="text-blue-600 dark:text-blue-300/80 text-sm">{mediaFile?.name} ({mediaType})</p>
                    </div>
                </div>
            )}

            {/* Campaign Scheduling - RESTORED */}
            <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={isScheduled}
                            onChange={e => setIsScheduled(e.target.checked)}
                            className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
                        />
                        <span className="text-gray-700 dark:text-gray-300 font-medium select-none">Schedule for later</span>
                    </label>

                    {isScheduled && (
                        <input
                            type="datetime-local"
                            value={scheduledAt}
                            onChange={e => setScheduledAt(e.target.value)}
                            className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-green-500"
                            min={new Date().toISOString().slice(0, 16)}
                        />
                    )}
                </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700 max-h-64 overflow-y-auto">
                <table className="w-full text-left text-sm text-gray-600 dark:text-gray-400">
                    <thead>
                        <tr>
                            <th className="pb-2">Phone</th>
                            <th className="pb-2">Email</th>
                            <th className="pb-2">Params</th>
                            <th className="pb-2 text-right">Preview</th>
                        </tr>
                    </thead>
                    <tbody>
                        {processedContacts.slice(0, 10).map((c, i) => (
                            <tr key={i} className="border-t border-gray-200 dark:border-gray-800">
                                <td className="py-2 text-gray-900 dark:text-white">{c.phone}</td>
                                <td className="py-2 text-gray-900 dark:text-white">{c.email || '-'}</td>
                                <td className="py-2 text-sm text-gray-500">{JSON.stringify(c.params)}</td>
                                <td className="py-2 text-right">
                                    <button
                                        onClick={() => setPreviewContact(c)}
                                        className="text-gray-500 hover:text-green-600 transition-colors"
                                        title="Preview Message"
                                    >
                                        <Eye size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {processedContacts.length > 10 && (
                            <tr>
                                <td colSpan="4" className="py-2 text-center text-xs text-gray-500">...and {processedContacts.length - 10} more</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Preview Modal */}
            {previewContact && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-200 dark:border-gray-700">
                        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
                            <h3 className="font-semibold text-gray-900 dark:text-white">Message Preview</h3>
                            <button onClick={() => setPreviewContact(null)} className="text-gray-500 hover:text-gray-900 dark:hover:text-white">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6">
                            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-100 dark:border-green-800/30">
                                <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-sans text-sm leading-relaxed">
                                    {renderMessage(previewContact)}
                                </p>
                            </div>
                            <div className="mt-4 text-xs text-gray-500 text-center">
                                This is exactly how the message will appear to <b>{previewContact.phone}</b>.
                            </div>
                        </div>
                    </div>
                </div>
            )}


            {showConfirm && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-600 p-4 rounded-lg flex items-start gap-3">
                    <AlertTriangle className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" size={20} />
                    <div className="flex-1">
                        <p className="text-yellow-800 dark:text-yellow-200 font-medium">Confirm Campaign Launch</p>
                        <p className="text-yellow-700 dark:text-yellow-300/80 text-sm mt-1">
                            You are about to send {summary.valid} messages. This action cannot be undone.
                        </p>
                    </div>
                </div>
            )
            }

            <p className="text-sm text-gray-500 italic text-center">
                By clicking send, you confirm these contacts have opted-in to receive messages.
            </p>

            <div className="flex gap-4">
                <button
                    onClick={onBack}
                    className="flex-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium py-3 rounded-lg transition-all"
                    disabled={loading}
                >
                    Back
                </button>
                {showConfirm ? (
                    <>
                        <button
                            onClick={() => setShowConfirm(false)}
                            className="flex-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium py-3 rounded-lg transition-all"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={loading}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-3 rounded-lg flex justify-center items-center gap-2 transition-all disabled:opacity-50"
                        >
                            {loading ? 'Launching...' : (
                                <>
                                    {isScheduled ? 'Schedule Campaign' : 'Confirm & Launch'}
                                    <Send size={18} />
                                </>
                            )}
                        </button>
                    </>
                ) : (
                    <button
                        onClick={handleSubmit}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-3 rounded-lg flex justify-center items-center gap-2 transition-all"
                    >
                        {isScheduled ? 'Schedule Campaign' : 'Launch Campaign'}
                        <Send size={18} />
                    </button>
                )}
            </div>
        </div >
    );
}
