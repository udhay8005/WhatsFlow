/**
 * @file CampaignDetailsStep.jsx
 * @description Step 1 of the campaign wizard. Collects campaign name, WhatsApp
 *              template selection (with variable preview), optional media attachment,
 *              and optional scheduled send date/time.
 * @module components/campaign/CampaignDetailsStep
 * @author Udhaya Chandra SA
 * @version 1.0.1
 */

import React, { useState, useEffect, useRef } from 'react';
import { Upload, X, ChevronDown, ChevronUp } from 'lucide-react';

export default function CampaignDetailsStep({
    campaignName, setCampaignName,
    templateId, setTemplateId,
    templates, loadingTemplates,
    setMediaFile,
    mediaPreview, setMediaPreview,
    setMediaId,
    mediaType, setMediaType,
    uploadingMedia, handleMediaUpload,
    onNext,
    onBack
}) {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Close dropdown on click outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Validate selection when templates change
    useEffect(() => {
        if (templateId && templates.length > 0) {
            const isValid = templates.some(t => t.name === templateId);
            if (!isValid) {
                setTemplateId(''); // Reset if selected template is no longer available
            }
        }
    }, [templates, templateId, setTemplateId]);

    const selectedTemplate = templates.find(t => t.name === templateId);
    return (
        <div className="space-y-6 max-w-md mx-auto">
            <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-300 mb-2">Campaign Name</label>
                <input
                    className="w-full bg-white dark:bg-gray-900 border border-gray-400 dark:border-gray-600 rounded-lg px-4 py-2 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    placeholder="e.g. Donor Thank You - January"
                    value={campaignName}
                    onChange={e => setCampaignName(e.target.value)}
                />
            </div>
            <div className="relative" ref={dropdownRef}>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-300 mb-2">Template</label>

                {/* Custom Trigger */}
                <div
                    onClick={() => !loadingTemplates && setIsDropdownOpen(!isDropdownOpen)}
                    className={`
                        w-full bg-white dark:bg-gray-900 border 
                        ${isDropdownOpen ? 'border-green-500 ring-2 ring-green-500/20' : 'border-gray-400 dark:border-gray-600'}
                        rounded-lg px-4 py-2 flex items-center justify-between cursor-pointer transition-all
                    `}
                >
                    <span className="text-gray-900 dark:text-white truncate">
                        {loadingTemplates ? 'Loading templates...' : (selectedTemplate ? `${selectedTemplate.name} (${selectedTemplate.language || 'en'})` : 'Select a template...')}
                    </span>
                    {isDropdownOpen ? <ChevronUp size={20} className="text-gray-500" /> : <ChevronDown size={20} className="text-gray-500" />}
                </div>

                {/* Dropdown Options */}
                {isDropdownOpen && !loadingTemplates && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {templates.length > 0 ? (
                            templates.map((t) => (
                                <div
                                    key={t.name}
                                    onClick={() => {
                                        setTemplateId(t.name);
                                        setIsDropdownOpen(false);
                                    }}
                                    className={`
                                        px-4 py-2 cursor-pointer hover:bg-green-50 dark:hover:bg-green-900/20
                                        ${templateId === t.name ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-l-4 border-green-500' : 'text-gray-700 dark:text-gray-200'}
                                    `}
                                >
                                    <div className="font-medium">{t.name}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">{t.language || 'en'} • {t.status}</div>
                                </div>
                            ))
                        ) : (
                            <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">No templates found</div>
                        )}
                    </div>
                )}

                <p className="text-xs text-gray-600 mt-2">Only APPROVED templates are shown.</p>
            </div>

            {/* Media Upload */}
            <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-300 mb-2">
                    Proof Media (Optional) <span className="text-gray-600 text-xs">- Photo or Video</span>
                </label>
                {!mediaPreview ? (
                    <div className="border-2 border-dashed border-gray-400 dark:border-gray-600 rounded-lg p-6 text-center hover:border-green-500 transition-colors cursor-pointer relative bg-white dark:bg-gray-800">
                        <input
                            type="file"
                            accept="image/jpeg,image/png,video/mp4"
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            onChange={handleMediaUpload}
                            disabled={uploadingMedia}
                        />
                        <Upload className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                        <p className="text-gray-600 text-sm">Click to upload media</p>
                        <p className="text-xs text-gray-500 mt-1">JPG, PNG, or MP4  (Max 16MB)</p>
                    </div>
                ) : (
                    <div className="relative border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-black">
                        {mediaType === 'video' ? (
                            <video src={mediaPreview} className="w-full max-h-48 object-contain" controls />
                        ) : (
                            <img src={mediaPreview} alt="Media preview" className="w-full max-h-48 object-contain" />
                        )}
                        <button
                            onClick={() => {
                                setMediaFile(null);
                                setMediaPreview(null);
                                setMediaId(null);
                                setMediaType(null);
                                URL.revokeObjectURL(mediaPreview);
                            }}
                            className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-2 rounded-full shadow-lg"
                            type="button"
                        >
                            <X size={16} />
                        </button>
                        {uploadingMedia && (
                            <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                                <p className="text-white font-medium">Uploading...</p>
                            </div>
                        )}
                    </div>
                )}
                <p className="text-xs text-gray-500 mt-2 flex items-start gap-1">
                    <span>ⓘ</span>
                    <span>This media will be attached to all messages in this campaign. Template must have a MEDIA HEADER placeholder.</span>
                </p>
            </div>

            <div className="flex gap-4 mt-6">
                <button
                    onClick={onBack}
                    className="flex-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-medium py-2 rounded-lg transition-all"
                >
                    Cancel
                </button>
                <button
                    disabled={!campaignName || !templateId}
                    onClick={onNext}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                    Next: Upload Contacts
                </button>
            </div>
        </div>
    );
}
