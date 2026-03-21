import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { apiService } from '../services/api';
import { parseExcelFile, normalizePhoneNumber } from '../utils/excelParser';
import { filterContacts, processContactList } from '../utils/contactProcessor';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { Save } from 'lucide-react';

// Sub-components
import CampaignDetailsStep from '../components/campaign/CampaignDetailsStep';
import ContactUploadStep from '../components/campaign/ContactUploadStep';
import CampaignReviewStep from '../components/campaign/CampaignReviewStep';

const STEPS = ['Details', 'Contacts', 'Review'];

export default function NewCampaign() {
    const navigate = useNavigate();
    const { addToast } = useToast();
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    // Form State
    const [campaignName, setCampaignName] = useState('');
    const [templateId, setTemplateId] = useState('');
    const [templates, setTemplates] = useState([]);
    const [loadingTemplates, setLoadingTemplates] = useState(false);

    // Media State
    const [mediaFile, setMediaFile] = useState(null);
    const [mediaPreview, setMediaPreview] = useState(null);
    const [mediaId, setMediaId] = useState(null);
    const [mediaType, setMediaType] = useState(null);
    const [uploadingMedia, setUploadingMedia] = useState(false);

    // Import State
    const [file, setFile] = useState(null);
    const [headers, setHeaders] = useState([]);
    const [rawRows, setRawRows] = useState([]);
    const [uploadProgress, setUploadProgress] = useState(0);

    // Mapping State
    const [phoneCol, setPhoneCol] = useState('');
    const [emailCol, setEmailCol] = useState('');
    const [dateCol, setDateCol] = useState(''); // New: Date Column

    // Advanced Contact Processing State
    const [duplicateMode, setDuplicateMode] = useState('keep'); // 'keep', 'skip', 'sum'
    const [sumColumn, setSumColumn] = useState('');
    const [templateParams, setTemplateParams] = useState([]);
    const [paramMappings, setParamMappings] = useState({}); // { '1': 'Name', '2': 'Amount' }

    // Filtering & Selection State
    const [filterType, setFilterType] = useState('all'); // 'all', 'rows', 'date'
    const [filterRange, setFilterRange] = useState({ start: '', end: '' });
    const [excludedRowIndices, setExcludedRowIndices] = useState(new Set()); // Indices to skip

    // Validation State
    const [processedContacts, setProcessedContacts] = useState([]);
    const [summary, setSummary] = useState({ valid: 0, invalid: 0 });

    // Scheduling State
    const [isScheduled, setIsScheduled] = useState(false);
    const [scheduledAt, setScheduledAt] = useState('');

    const { id } = useParams(); // Campaign ID for editing/resuming
    const isEditMode = !!id;

    useEffect(() => {
        const fetchTemplates = async () => {
            await loadTemplates();
        };
        fetchTemplates().catch(err => {
            console.error('Failed to load templates on mount:', err);
            addToast('Critical: Could not load templates. Please refresh.', 'error');
        });

        // Load Campaign Data if Editing
        if (id) {
            loadCampaignData(id);
        }

        return () => {
            if (mediaPreview) URL.revokeObjectURL(mediaPreview);
        };
    }, [id]);

    const loadCampaignData = async (campaignId) => {
        try {
            setLoading(true);
            const res = await apiService.getCampaignDetails(campaignId);
            const campaign = res.data;

            setCampaignName(campaign.name);
            setTemplateId(campaign.template_name);

            // If scheduled
            if (campaign.scheduled_at) {
                setIsScheduled(true);
                setScheduledAt(campaign.scheduled_at.slice(0, 16));
            }

            // Media (If ID exists)
            if (campaign.media_id) {
                setMediaId(campaign.media_id);
                setMediaType(campaign.media_type);
                // Note: We can't easily preview the remote media without a URL, 
                // but we assume it's stored.
                setMediaPreview('stored'); // Placeholder to show something is there
            }

            // Restore Contacts from Messages
            if (campaign.messages && campaign.messages.length > 0) {
                const restored = campaign.messages.map(m => ({
                    phone: m.phone_number,
                    // email? not in message table usually, unless we joined contacts. 
                    // Backend getCampaignDetails joins contacts table?
                    // Let's assume params are in variable_data
                    params: m.variable_data ? JSON.parse(m.variable_data) : []
                }));
                setProcessedContacts(restored);
                setSummary({ valid: restored.length, invalid: 0 });
                setStep(2); // Jump to Review
            }

        } catch (err) {
            console.error("Failed to load draft", err);
            addToast("Failed to load draft", "error");
        } finally {
            setLoading(false);
        }
    };

    // Update template params when template is selected
    useEffect(() => {
        if (!templateId) {
            setTemplateParams([]);
            setParamMappings({}); // Clear mappings when template changes
            return;
        }
        const selected = templates.find(t => t.name === templateId);
        if (selected) {
            const bodyComponent = selected.components.find(c => c.type === 'BODY');
            if (bodyComponent && bodyComponent.text) {
                const matches = bodyComponent.text.match(/{{(\d+)}}/g) || [];
                const params = [...new Set(matches.map(m => m.match(/\d+/)[0]))].sort((a, b) => parseInt(a) - parseInt(b));
                setTemplateParams(params);
                // Initialize paramMappings for new template
                const initialMappings = {};
                params.forEach(p => {
                    initialMappings[p] = ''; // Default to empty
                });
                setParamMappings(initialMappings);
            } else {
                setTemplateParams([]);
                setParamMappings({});
            }
        }
    }, [templateId, templates]);

    const loadTemplates = async () => {
        setLoadingTemplates(true);
        try {
            const res = await apiService.getTemplates();
            // Critical Fix: check if res.data is actually an array
            const validTemplates = Array.isArray(res.data)
                ? res.data.filter(t => t?.status === 'APPROVED')
                : [];
            setTemplates(validTemplates);
            if (validTemplates.length > 0) setTemplateId(validTemplates[0].name);
            else addToast('No approved templates found. Please create templates in your WhatsApp Business account.', 'error');
        } catch (err) {
            addToast('Failed to load templates: ' + (err.response?.data?.error || err.message), 'error');
            setTemplates([]);
        } finally {
            setLoadingTemplates(false);
        }
    };

    const handleFileUpload = async (e) => {
        const f = e.target.files[0];
        if (!f) return;

        setFile(f);
        setUploadProgress(30);

        try {
            const { headers, rows } = await parseExcelFile(f);
            setHeaders(headers);
            setRawRows(rows);
            setUploadProgress(100);

            // Auto-detect columns
            const probablePhone = headers.find(h => /phone|mobile|whatsapp/i.test(h));
            if (probablePhone) setPhoneCol(probablePhone);

            const probableEmail = headers.find(h => /email|mail|e-mail/i.test(h));
            if (probableEmail) setEmailCol(probableEmail);

            if (rows.length > 1000) {
                addToast('Warning: Large contact lists (1000+) may take several minutes to process', 'warning');
            }

            addToast(`Loaded ${rows.length} rows successfully`, 'success');
        } catch (err) {
            addToast('Failed to parse file: ' + err.message, 'error');
            setFile(null);
        } finally {
            setTimeout(() => setUploadProgress(0), 1000);
        }
    };

    const handleMediaUpload = async (e) => {
        const f = e.target.files[0];
        if (!f) return;

        // Validate file size (16MB)
        if (f.size > 16 * 1024 * 1024) {
            addToast('File too large. Maximum size is 16MB.', 'error');
            return;
        }

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'video/mp4'];
        if (!allowedTypes.includes(f.type)) {
            addToast('Invalid file type. Only JPG, PNG, and MP4 are allowed.', 'error');
            return;
        }

        setMediaFile(f);
        const preview = URL.createObjectURL(f);
        setMediaPreview(preview);

        setUploadingMedia(true);
        try {
            const formData = new FormData();
            formData.append('file', f);

            const response = await apiService.uploadMedia(formData);
            setMediaId(response.data.mediaId);
            setMediaType(response.data.mediaType);

            addToast('Media uploaded successfully!', 'success');
        } catch (err) {
            addToast('Media upload failed: ' + err.message, 'error');
            setMediaFile(null);
            setMediaPreview(null);
            setMediaId(null);
            setMediaType(null);
            if (preview) URL.revokeObjectURL(preview);
        } finally {
            setUploadingMedia(false);
        }
    };

    // Helper to extract params from a row
    const processParams = (row) => {
        return templateParams.map(p => {
            const mapping = paramMappings[p];
            if (!mapping) return '';

            if (mapping === 'CUSTOM_STATIC') {
                return paramMappings[`${p}_static`] || '';
            }

            const colIndex = headers.indexOf(mapping);
            return colIndex >= 0 ? (row[colIndex] || '') : '';
        });
    };

    const processContacts = () => {
        if (!phoneCol) {
            addToast('Please select a phone column', 'warning');
            return;
        }

        // 1. Filter Rows
        const filteredRows = filterContacts(rawRows, {
            filterType,
            filterRange,
            dateCol,
            headers,
            excludedRowIndices
        });

        // 2. Process Valid Rows
        const { validList, invCount } = processContactList(filteredRows, {
            phoneCol,
            emailCol,
            dateCol,
            sumColumn,
            duplicateMode,
            templateParams,
            paramMappings,
            headers
        });

        setProcessedContacts(validList);
        setSummary({ valid: validList.length, invalid: invCount });

        if (validList.length === 0) {
            addToast('No valid contacts found!', 'error');
        } else {
            setStep(2);
        }
    };

    const handleSubmit = async (targetStatus = 'active') => {
        if (!campaignName || !templateId) {
            addToast('Please fill in campaign name and template', 'error');
            return;
        }
        if (processedContacts.length === 0 && targetStatus === 'active') {
            addToast('No valid contacts to send to', 'error');
            return;
        }

        // Two-step confirmation for launching campaigns (active status)
        // One-step for saving drafts
        if (targetStatus === 'active' && !showConfirm) {
            setShowConfirm(true);
            return;
        }

        setLoading(true);
        try {
            const payload = {
                name: campaignName,
                templateName: templateId,
                contacts: processedContacts,
                mediaId: mediaId,
                mediaType: mediaType,
                scheduledAt: isScheduled && scheduledAt ? new Date(scheduledAt).toISOString() : null,
                status: targetStatus
            };

            if (isEditMode) {
                // UPDATE existing
                await apiService.updateCampaign(id, payload);
                addToast(`Campaign ${targetStatus === 'draft' ? 'saved' : 'updated'} successfully!`, 'success');
            } else {
                // CREATE new
                await apiService.createCampaign(payload);
                addToast(`Campaign ${targetStatus === 'draft' ? 'saved' : 'created'} successfully!`, 'success');
            }

            navigate('/');
        } catch (err) {
            const errorMsg = err.response?.data?.error || err.message;
            addToast('Error: ' + errorMsg, 'error');
        } finally {
            setLoading(false);
            setShowConfirm(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {isEditMode ? 'Edit Campaign' : 'New Campaign'}
                </h1>
                <button
                    onClick={() => handleSubmit('draft')}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg text-gray-700 dark:text-gray-200 font-medium transition-colors"
                >
                    <Save size={18} />
                    Save Draft
                </button>
            </div>

            {/* Stepper */}
            <div className="flex items-center justify-center space-x-4 mb-8">
                {STEPS.map((s, i) => (
                    <div key={i} className={`flex items-center ${i <= step ? 'text-green-500' : 'text-gray-500'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${i <= step ? 'border-green-500 bg-green-500/20' : 'border-gray-400 dark:border-gray-600 bg-gray-200 dark:bg-gray-800'
                            }`}>
                            {i < step ? <Check size={16} /> : i + 1}
                        </div>
                        <span className="ml-2 font-medium">{s}</span>
                        {i < STEPS.length - 1 && <div className="w-12 h-0.5 bg-gray-300 dark:bg-gray-700 ml-4" />}
                    </div>
                ))}
            </div>

            <div className="bg-white dark:bg-gray-800 p-8 rounded-xl border border-gray-200 dark:border-gray-700 min-h-[400px] shadow-sm">

                {/* Step 0: Details */}
                {step === 0 && (
                    <CampaignDetailsStep
                        campaignName={campaignName} setCampaignName={setCampaignName}
                        templateId={templateId} setTemplateId={setTemplateId}
                        templates={templates} loadingTemplates={loadingTemplates}
                        mediaFile={mediaFile} setMediaFile={setMediaFile}
                        mediaPreview={mediaPreview} setMediaPreview={setMediaPreview}
                        mediaId={mediaId} setMediaId={setMediaId}
                        mediaType={mediaType} setMediaType={setMediaType}
                        uploadingMedia={uploadingMedia} handleMediaUpload={handleMediaUpload}
                        onNext={() => setStep(1)}
                        onBack={() => navigate('/')}
                    />
                )}

                {/* Step 1: Upload & Map */}
                {step === 1 && (
                    <ContactUploadStep
                        file={file} setFile={setFile}
                        headers={headers} rawRows={rawRows}
                        uploadProgress={uploadProgress}
                        phoneCol={phoneCol} setPhoneCol={setPhoneCol}
                        emailCol={emailCol} setEmailCol={setEmailCol}
                        handleFileUpload={handleFileUpload}
                        processContacts={processContacts}
                        onBack={() => setStep(0)}
                        // New Props
                        duplicateMode={duplicateMode} setDuplicateMode={setDuplicateMode}
                        sumColumn={sumColumn} setSumColumn={setSumColumn}
                        templateParams={templateParams}
                        paramMappings={paramMappings} setParamMappings={setParamMappings}
                        // Filtering & Selection Props
                        dateCol={dateCol} setDateCol={setDateCol}
                        filterType={filterType} setFilterType={setFilterType}
                        filterRange={filterRange} setFilterRange={setFilterRange}
                        excludedRowIndices={excludedRowIndices} setExcludedRowIndices={setExcludedRowIndices}
                    />
                )}

                {/* Step 2: Review */}
                {step === 2 && (
                    <CampaignReviewStep
                        summary={summary} processedContacts={processedContacts}
                        mediaPreview={mediaPreview} mediaType={mediaType} mediaFile={mediaFile}
                        handleSubmit={() => handleSubmit('active')} loading={loading}
                        showConfirm={showConfirm} setShowConfirm={setShowConfirm}
                        isScheduled={isScheduled} setIsScheduled={setIsScheduled}
                        scheduledAt={scheduledAt} setScheduledAt={setScheduledAt}
                        onBack={() => { setStep(1); setShowConfirm(false); }}
                        selectedTemplate={templates.find(t => t.name === templateId)}
                    />
                )}
            </div>
        </div>
    );
}

