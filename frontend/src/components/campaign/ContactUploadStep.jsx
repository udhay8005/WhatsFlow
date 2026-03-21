/**
 * @file ContactUploadStep.jsx
 * @description Step 2 of the campaign wizard. Handles contact list upload via
 *              Excel/CSV file or manual entry. Runs pre-flight eligibility checks
 *              against the blacklist and 24-hour frequency guard, then displays
 *              a summary with warn/error counts before the user proceeds.
 * @module components/campaign/ContactUploadStep
 * @author Udhaya Chandra SA
 * @version 1.0.1
 */

import React from 'react';
import { Upload, FileSpreadsheet, X, AlertTriangle, ShieldAlert } from 'lucide-react';
import { apiService } from '../../services/api';

export default function ContactUploadStep({
    file, setFile,
    headers, rawRows,
    uploadProgress,
    phoneCol, setPhoneCol,
    emailCol, setEmailCol,
    handleFileUpload,
    processContacts,
    onBack,
    // New Props
    duplicateMode, setDuplicateMode,
    sumColumn, setSumColumn,
    templateParams,
    paramMappings, setParamMappings,
    // Filtering & Selection Props
    dateCol, setDateCol,
    filterType, setFilterType,
    filterRange, setFilterRange,
    excludedRowIndices, setExcludedRowIndices
}) {
    // Computing filtered rows for display
    const getFilteredRows = () => {
        let filtered = rawRows.map((row, idx) => ({ row, idx }));

        if (filterType === 'rows') {
            const start = parseInt(filterRange.start) || 1;
            const end = parseInt(filterRange.end) || rawRows.length;
            const _startIndex = Math.max(0, start - 2); // computed but not used in display filter
            // In display logic, we just want to visually check if it matches range
            // But let's reuse logic: display ALL valid for filter, user can check/uncheck
            // If we filter, we only SHOW matching.
            filtered = filtered.filter(item => {
                const rowNum = item.idx + 2;
                return rowNum >= start && rowNum <= end;
            });
        } else if (filterType === 'date' && dateCol) {
            const dateIndex = headers.indexOf(dateCol);
            if (dateIndex >= 0) {
                const startDate = filterRange.start ? new Date(filterRange.start) : null;
                const endDate = filterRange.end ? new Date(filterRange.end) : null;
                if (startDate) startDate.setHours(0, 0, 0, 0);
                if (endDate) endDate.setHours(23, 59, 59, 999);

                filtered = filtered.filter(item => {
                    const d = new Date(item.row[dateIndex]);
                    if (isNaN(d.getTime())) return false;
                    if (startDate && d < startDate) return false;
                    if (endDate && d > endDate) return false;
                    return true;
                });
            }
        }
        return filtered;
    };

    const displayRows = getFilteredRows();

    const toggleRow = (idx) => {
        const newSet = new Set(excludedRowIndices);
        if (newSet.has(idx)) newSet.delete(idx);
        else newSet.add(idx);
        setExcludedRowIndices(newSet);
    };

    const toggleAll = () => {
        if (displayRows.every(r => excludedRowIndices.has(r.idx))) {
            // Unselect all -> Clear for these rows (include them)
            const newSet = new Set(excludedRowIndices);
            displayRows.forEach(r => newSet.delete(r.idx));
            setExcludedRowIndices(newSet);
        } else {
            // Select all -> Exclude all? No, logical "select" means INCLUDE.
            // Checkbox checked = Included (NOT in excluded set).
            // So "Select All" means REMOVE from excluded set.
            // "Deselect All" means ADD to excluded set.
            const allIncluded = displayRows.every(r => !excludedRowIndices.has(r.idx));
            const newSet = new Set(excludedRowIndices);

            if (allIncluded) {
                // Deselect all -> Add to excluded
                displayRows.forEach(r => newSet.add(r.idx));
            } else {
                // Select all -> Remove from excluded
                displayRows.forEach(r => newSet.delete(r.idx));
            }
            setExcludedRowIndices(newSet);
        }
    };

    const [eligibilityData, setEligibilityData] = React.useState({ blacklisted: [], limited: [] });
    const [_checkingEligibility, setCheckingEligibility] = React.useState(false);

    // Derived state for Select All checkbox
    const isAllSelected = displayRows.length > 0 && displayRows.every(r => !excludedRowIndices.has(r.idx));
    const isIndeterminate = displayRows.some(r => excludedRowIndices.has(r.idx)) && !isAllSelected;

    // Check Eligibility when Phone Column is selected
    React.useEffect(() => {
        if (!phoneCol || !rawRows.length) return;

        const checkSAFETY = async () => {
            setCheckingEligibility(true);
            try {
                // Extract phones based on current mapping
                const phoneIndex = headers.indexOf(phoneCol);
                const contactsToCheck = rawRows.map(r => ({ phone: String(r[phoneIndex]) }));

                // Chunking to avoid massive payload? For now assume reasonable size <2000
                const response = await apiService.checkEligibility(contactsToCheck);
                const { blacklisted, limited } = response.data;
                setEligibilityData({ blacklisted: blacklisted || [], limited: limited || [] });

                // Auto-exclude Blacklisted (Strict)
                if (blacklisted?.length > 0) {
                    const blackSet = new Set(blacklisted.map(b => b.phone));
                    const newExcluded = new Set(excludedRowIndices);
                    rawRows.forEach((row, idx) => {
                        const p = String(row[phoneIndex]);
                        if (blackSet.has(p)) newExcluded.add(idx);
                    });
                    setExcludedRowIndices(newExcluded);
                }

            } catch (err) {
                console.error('Safety Check Failed:', err);
            } finally {
                setCheckingEligibility(false);
            }
        };

        const timeout = setTimeout(checkSAFETY, 800); // Debounce
        return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phoneCol, rawRows]); // Intentionally limited: re-run only when phone col or file changes

    // Helper to check row status
    const getRowSafetyStatus = (row) => {
        if (!phoneCol) return 'safe';
        const phoneIndex = headers.indexOf(phoneCol);
        const phone = String(row[phoneIndex]);

        const isBlacklisted = eligibilityData.blacklisted.find(b => b.phone === phone);
        if (isBlacklisted) return { status: 'blacklist', reason: isBlacklisted.reason };

        const isLimited = eligibilityData.limited.find(l => l.phone === phone);
        if (isLimited) return { status: 'limited', lastSent: isLimited.lastSent };

        return { status: 'safe' };
    };



    return (
        <div className="space-y-6">
            {!file ? (
                <div className="border-2 border-dashed border-gray-400 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-xl p-12 text-center hover:border-green-500 transition-colors cursor-pointer relative">
                    <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        onChange={handleFileUpload}
                    />
                    <Upload className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">Drop your Excel/CSV file here</h3>
                    <p className="text-gray-600">Supports .xlsx, .csv (Max 10MB)</p>
                </div>
            ) : (
                <><div className="space-y-6">
                    <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-400 dark:border-gray-700">
                        <div className="flex items-center gap-3 flex-1">
                            <FileSpreadsheet className="text-green-600" />
                            <div className="flex-1">
                                <p className="text-gray-900 dark:text-white font-medium">{file.name}</p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">{rawRows.length} rows detected</p>
                                {uploadProgress > 0 && uploadProgress < 100 && (
                                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-2">
                                        <div className="bg-green-500 h-1.5 rounded-full transition-all" style={{ width: `${uploadProgress}%` }}></div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <button onClick={() => setFile(null)} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"><X size={20} /></button>
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                        <div>
                            <label className="block text-sm font-medium text-gray-900 dark:text-gray-300 mb-2">Map Phone Column <span className="text-red-600">*</span></label>
                            <select
                                className="w-full bg-white dark:bg-gray-900 border border-gray-400 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                                value={phoneCol}
                                onChange={e => setPhoneCol(e.target.value)}
                            >
                                <option value="">-- Select Column --</option>
                                {headers.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-900 dark:text-gray-300 mb-2">Map Email Column (Optional)</label>
                            <select
                                className="w-full bg-white dark:bg-gray-900 border border-gray-400 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                                value={emailCol}
                                onChange={e => setEmailCol(e.target.value)}
                            >
                                <option value="">-- Skip Email --</option>
                                {headers.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                        </div>

                        {/* Date Column Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-900 dark:text-gray-300 mb-2">Map Date Column (Optional)</label>
                            <select
                                className="w-full bg-white dark:bg-gray-900 border border-gray-400 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 outline-none"
                                value={dateCol}
                                onChange={e => setDateCol(e.target.value)}
                            >
                                <option value="">-- Select Date Column --</option>
                                {headers.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                            <p className="text-xs text-gray-500 mt-1">Required for Date filtering and Date-based grouping</p>
                        </div>
                    </div>

                    {/* Filtering Section */}
                    <div className="border border-gray-200 dark:border-gray-700 p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                        <h4 className="font-medium text-gray-900 dark:text-white mb-3">Filter & Select Data</h4>
                        <div className="flex gap-4 mb-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="filterType" checked={filterType === 'all'} onChange={() => setFilterType('all')} className="text-green-600" />
                                <span className="text-sm dark:text-gray-300">All Rows</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="filterType" checked={filterType === 'rows'} onChange={() => setFilterType('rows')} className="text-green-600" />
                                <span className="text-sm dark:text-gray-300">By Row Number</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="filterType" checked={filterType === 'date'} onChange={() => setFilterType('date')} className="text-green-600" disabled={!dateCol} />
                                <span className={`text-sm ${!dateCol ? 'text-gray-400' : 'dark:text-gray-300'}`}>By Date Range</span>
                            </label>
                        </div>

                        {/* Range Inputs */}
                        {filterType === 'rows' && (
                            <div className="flex gap-4 items-center mb-4">
                                <input
                                    type="number"
                                    placeholder="Start Row (e.g. 2)"
                                    className="border rounded px-2 py-1 bg-white dark:bg-gray-900 dark:border-gray-600 dark:text-white"
                                    value={filterRange.start}
                                    onChange={e => setFilterRange(p => ({ ...p, start: e.target.value }))} />
                                <span className="text-gray-500">-</span>
                                <input
                                    type="number"
                                    placeholder="End Row"
                                    className="border rounded px-2 py-1 bg-white dark:bg-gray-900 dark:border-gray-600 dark:text-white"
                                    value={filterRange.end}
                                    onChange={e => setFilterRange(p => ({ ...p, end: e.target.value }))} />
                            </div>
                        )}

                        {filterType === 'date' && (
                            <div className="flex gap-4 items-center mb-4">
                                <input
                                    type="date"
                                    className="border rounded px-2 py-1 bg-white dark:bg-gray-900 dark:border-gray-600 dark:text-white"
                                    value={filterRange.start}
                                    onChange={e => setFilterRange(p => ({ ...p, start: e.target.value }))} />
                                <span className="text-gray-500">-</span>
                                <input
                                    type="date"
                                    className="border rounded px-2 py-1 bg-white dark:bg-gray-900 dark:border-gray-600 dark:text-white"
                                    value={filterRange.end}
                                    onChange={e => setFilterRange(p => ({ ...p, end: e.target.value }))} />
                            </div>
                        )}

                        {/* Data Preview Table */}
                        <div className="max-h-60 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900">
                            <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-700 dark:text-gray-400 sticky top-0">
                                    <tr>
                                        <th className="p-2 w-10 text-center">
                                            <input type="checkbox" checked={isAllSelected} ref={input => { if (input) input.indeterminate = isIndeterminate; }} onChange={toggleAll} />
                                        </th>
                                        <th className="p-2">Row</th>
                                        {headers.slice(0, 3).map(h => <th key={h} className="p-2">{h}</th>)}
                                        {headers.length > 3 && <th className="p-2">...</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayRows.length === 0 ? (
                                        <tr><td colSpan="5" className="p-4 text-center">No rows match filter.</td></tr>
                                    ) : (
                                        displayRows.slice(0, 100).map(({ row, idx }) => {
                                            const safety = getRowSafetyStatus(row);
                                            const isExcluded = excludedRowIndices.has(idx);

                                            // Determine Row Style
                                            let bgClass = "hover:bg-gray-50 dark:hover:bg-gray-800";
                                            if (safety.status === 'blacklist') bgClass = "bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20";
                                            else if (safety.status === 'limited') bgClass = "bg-orange-50 dark:bg-orange-900/10 hover:bg-orange-100 dark:hover:bg-orange-900/20";

                                            return (
                                                <tr key={idx} className={`border-b dark:border-gray-700 ${bgClass}`}>
                                                    <td className="p-2 text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={!isExcluded}
                                                            onChange={() => toggleRow(idx)}
                                                            disabled={safety.status === 'blacklist'} // Force exclude blacklist
                                                        />
                                                    </td>
                                                    <td className="p-2 text-gray-400 flex items-center gap-2">
                                                        {idx + 2}
                                                        {safety.status === 'blacklist' && (
                                                            <div className="group relative">
                                                                <ShieldAlert size={14} className="text-red-500" />
                                                                <span className="absolute left-full ml-2 bg-gray-800 text-white text-xs px-2 py-1 rounded hidden group-hover:block whitespace-nowrap z-10">
                                                                    Blacklisted: {safety.reason || 'No reason'}
                                                                </span>
                                                            </div>
                                                        )}
                                                        {safety.status === 'limited' && (
                                                            <div className="group relative">
                                                                <AlertTriangle size={14} className="text-orange-500" />
                                                                <span className="absolute left-full ml-2 bg-gray-800 text-white text-xs px-2 py-1 rounded hidden group-hover:block whitespace-nowrap z-10">
                                                                    Frequency Cap: Sent {new Date(safety.lastSent).toLocaleString()}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </td>
                                                    {row.slice(0, 3).map((cell, cIdx) => (
                                                        <td key={cIdx} className="p-2 truncate max-w-[150px]">{String(cell)}</td>
                                                    ))}
                                                    {row.length > 3 && <td className="p-2">...</td>}
                                                </tr>
                                            );
                                        })
                                    )}
                                    {displayRows.length > 100 && (
                                        <tr><td colSpan="5" className="p-2 text-center text-xs text-gray-500">Showing first 100 of {displayRows.length} matching rows</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <p className="text-xs text-right text-gray-500 mt-1">
                            {displayRows.length - Array.from(excludedRowIndices).filter(idx => displayRows.some(r => r.idx === idx)).length} selected of {displayRows.length} matching
                        </p>
                    </div>

                    {/* Duplicate Handling Mode */}
                    <div className="col-span-2 border-t border-gray-200 dark:border-gray-700 pt-4 mt-2">
                        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-3">Duplicate Handling Strategy</label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Option A: Keep All */}
                            <label className={`border rounded-lg p-3 cursor-pointer transition-colors ${duplicateMode === 'keep' ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-gray-300 dark:border-gray-600'}`}>
                                <div className="flex items-center gap-2">
                                    <input type="radio" name="dupMode" checked={duplicateMode === 'keep'} onChange={() => setDuplicateMode('keep')} className="text-green-600 focus:ring-green-500" />
                                    <span className="font-medium text-gray-900 dark:text-white">Separate Messages</span>
                                </div>
                                <p className="text-xs text-gray-500 ml-6 mt-1">Send 1 msg per row (e.g., 3 separate msgs)</p>
                            </label>

                            {/* Option B: Combine List */}
                            <label className={`border rounded-lg p-3 cursor-pointer transition-colors ${duplicateMode === 'list' ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-gray-300 dark:border-gray-600'}`}>
                                <div className="flex items-center gap-2">
                                    <input type="radio" name="dupMode" checked={duplicateMode === 'list'} onChange={() => setDuplicateMode('list')} className="text-green-600 focus:ring-green-500" />
                                    <span className="font-medium text-gray-900 dark:text-white">Combine List</span>
                                </div>
                                <p className="text-xs text-gray-500 ml-6 mt-1">Send 1 msg with comma-separated values</p>
                            </label>

                            {/* Option C: Total Sum */}
                            <label className={`border rounded-lg p-3 cursor-pointer transition-colors ${duplicateMode === 'sum' ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-gray-300 dark:border-gray-600'}`}>
                                <div className="flex items-center gap-2">
                                    <input type="radio" name="dupMode" checked={duplicateMode === 'sum'} onChange={() => setDuplicateMode('sum')} className="text-green-600 focus:ring-green-500" />
                                    <span className="font-medium text-gray-900 dark:text-white">Sum Total</span>
                                </div>
                                <p className="text-xs text-gray-500 ml-6 mt-1">Send 1 msg with total sum amount</p>
                            </label>
                        </div>
                    </div>

                    {/* Column Selection for Detail/Sum */}
                    {(duplicateMode === 'sum' || duplicateMode === 'list') && (
                        <div className="col-span-2 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                            <label className="block text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                                {duplicateMode === 'sum' ? 'Select Amount Column to Sum' : 'Select Column to List'}
                            </label>
                            <select
                                className="w-full bg-white dark:bg-gray-900 border border-blue-300 dark:border-blue-700 rounded-lg px-3 py-2"
                                value={sumColumn}
                                onChange={e => setSumColumn(e.target.value)}
                            >
                                <option value="">-- Select Column --</option>
                                {headers.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                            {dateCol && (
                                <p className="text-xs text-blue-600 dark:text-blue-300 mt-2">
                                    <span className="font-semibold">Note:</span> Since Date Column is selected, {duplicateMode === 'sum' ? 'date range (Start - End) will be calculated.' : 'values will be listed as "Value (Date)".'}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Template Variable Mapping */}
                    {templateParams.length > 0 && (
                        <div className="col-span-2 border-t border-gray-200 dark:border-gray-700 pt-4">
                            <h4 className="font-medium text-gray-900 dark:text-white mb-4">Map Template Variables</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {templateParams.map(param => (
                                    <div key={param}>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Variable {`{{${param}}}`}
                                        </label>
                                        <select
                                            className="w-full bg-white dark:bg-gray-900 border border-gray-400 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 outline-none"
                                            value={paramMappings[param] || ''}
                                            onChange={e => setParamMappings(prev => ({ ...prev, [param]: e.target.value }))}
                                        >
                                            <option value="">-- Select Column --</option>
                                            <option value="CUSTOM_STATIC">-- Custom Static Text --</option>
                                            {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                        </select>

                                        {/* Static Text Input */}
                                        {paramMappings[param] === 'CUSTOM_STATIC' && (
                                            <input
                                                type="text"
                                                placeholder="Enter static text"
                                                className="mt-2 w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm"
                                                onChange={e => setParamMappings(prev => ({ ...prev, [`${param}_static`]: e.target.value }))} />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div><div className="flex gap-4">
                        <button
                            onClick={onBack}
                            className="flex-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-medium py-3 rounded-lg transition-all"
                        >
                            Back
                        </button>
                        <button
                            onClick={processContacts}
                            disabled={!phoneCol}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            Validate & Review
                        </button>
                    </div></>
            )}
        </div>
    );
}


