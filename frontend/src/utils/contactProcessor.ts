import { normalizePhoneNumber } from './excelParser';

export interface FilterOptions {
    filterType: 'all' | 'rows' | 'date';
    filterRange: { start: string; end: string };
    dateCol?: string;
    headers: string[];
    excludedRowIndices?: Set<number>;
}

export interface ProcessOptions {
    phoneCol: string;
    emailCol?: string;
    dateCol?: string;
    sumColumn?: string;
    duplicateMode: 'keep' | 'list' | 'sum';
    templateParams: string[];
    paramMappings: Record<string, string>;
    headers: string[];
}

/**
 * Filters raw rows based on selected filter criteria (Rows, Date) and manual exclusions.
 */
export function filterContacts(rawRows: any[][], options: FilterOptions) {
    const { filterType, filterRange, dateCol, headers, excludedRowIndices } = options;

    let filteredRows = rawRows.map((row, index) => ({ row, index }));

    // 1. Filter by Range/Date
    if (filterType === 'rows') {
        const start = parseInt(filterRange.start) || 1;
        const end = parseInt(filterRange.end) || rawRows.length;
        filteredRows = filteredRows.filter(item => {
            const globalRowNumber = item.index + 2; // +2 because 0-index + 1 header row
            return globalRowNumber >= start && globalRowNumber <= end;
        });
    } else if (filterType === 'date' && dateCol) {
        const dateIndex = headers.indexOf(dateCol);
        if (dateIndex >= 0) {
            const startDate = filterRange.start ? new Date(filterRange.start) : null;
            const endDate = filterRange.end ? new Date(filterRange.end) : null;
            if (startDate) startDate.setHours(0, 0, 0, 0);
            if (endDate) endDate.setHours(23, 59, 59, 999);

            filteredRows = filteredRows.filter(item => {
                const cellVal = item.row[dateIndex];
                const d = new Date(cellVal);
                if (isNaN(d.getTime())) return false;
                if (startDate && d < startDate) return false;
                if (endDate && d > endDate) return false;
                return true;
            });
        }
    }

    // 2. Exclude Manually Deselected
    if (excludedRowIndices && excludedRowIndices.size > 0) {
        filteredRows = filteredRows.filter(item => !excludedRowIndices.has(item.index));
    }

    return filteredRows;
}

/**
 * Processes filtered rows into final contact list (Valid/Invalid)
 * Handles phone normalization, duplication modes (Merge/Sum), and parameter mapping.
 */
export function processContactList(filteredRows: { row: any[], index: number }[], options: ProcessOptions) {
    const { phoneCol, emailCol, dateCol, sumColumn, duplicateMode, templateParams, paramMappings, headers } = options;

    const phoneIndex = headers.indexOf(phoneCol);
    const emailIndex = emailCol ? headers.indexOf(emailCol) : -1;
    const dateIndex = dateCol ? headers.indexOf(dateCol) : -1;
    const sumIndex = sumColumn ? headers.indexOf(sumColumn) : -1;

    const validList: any[] = [];
    let invCount = 0;
    const groups: Record<string, any> = {};

    filteredRows.forEach(({ row }) => {
        const rawPhone = row[phoneIndex];
        const normalized = normalizePhoneNumber(rawPhone);
        const email = (emailIndex >= 0 ? row[emailIndex] : '').trim();

        if (normalized && normalized.length >= 10 && normalized.length <= 15) {
            // Ensure E.164 format by adding '+'
            const e164Phone = '+' + normalized;

            // Determine Date for this row (if dateCol selected)
            let rowDateStr = '';
            // Only try to format date if we are merging? Or always?
            // The original code only did this if duplicateMode !== 'keep' && dateIndex >= 0
            // But 'keep' mode also used rowDateStr for direct mapping.
            // Let's consistently parse if dateIndex valid.
            if (dateIndex >= 0) {
                try {
                    const d = new Date(row[dateIndex]);
                    if (!isNaN(d.getTime())) {
                        rowDateStr = d.toLocaleDateString('en-GB'); // DD/MM/YYYY
                    } else {
                        rowDateStr = String(row[dateIndex]);
                    }
                } catch (e) { rowDateStr = String(row[dateIndex]); }
            }

            if (duplicateMode === 'keep') {
                // Standard processing (No merge)
                const params = templateParams.map(p => {
                    const mapping = paramMappings[p];
                    if (!mapping) return '';
                    if (mapping === 'CUSTOM_STATIC') return paramMappings[`${p}_static`] || '';

                    // Map Date Column directly if selected
                    if (mapping === dateCol && dateIndex >= 0) return rowDateStr || row[dateIndex] || '';

                    const colIndex = headers.indexOf(mapping);
                    return colIndex >= 0 ? (row[colIndex] || '') : '';
                });
                validList.push({ phone: e164Phone, email, params });

            } else {
                // Grouping for List or Sum
                if (!groups[e164Phone]) {
                    groups[e164Phone] = {
                        phone: e164Phone,
                        email, // Take first email? Or latest? Original code took latest (implicitly by overwrite or first init?)
                        // Original code: groups[normalized] created once. But updated row on every iteration.
                        // So email effectively became the LAST row's email.
                        // Let's replicate original behavior: update row on every hit.
                        row: row,
                        count: 0,
                        _sumTotal: 0,
                        _values: [],
                        _dates: []
                    };
                }
                groups[e164Phone].count++;
                groups[e164Phone].row = row; // Update to latest row for static mappings
                // Update email to latest too?
                groups[e164Phone].email = email;

                if (sumIndex >= 0) {
                    const rawVal = row[sumIndex];
                    if (duplicateMode === 'sum') {
                        const val = parseFloat(rawVal?.toString().replace(/[^\d.-]/g, '')) || 0;
                        groups[e164Phone]._sumTotal += val;
                        if (rowDateStr && dateIndex >= 0) groups[e164Phone]._dates.push(new Date(row[dateIndex]));
                    } else {
                        // List Mode
                        if (rawVal) {
                            const valStr = String(rawVal);
                            const entry = rowDateStr ? `${valStr} (${rowDateStr})` : valStr;
                            groups[e164Phone]._values.push(entry);
                        }
                    }
                }
            }
        } else {
            invCount++;
        }
    });

    // Finalize Groups
    if (duplicateMode !== 'keep') {
        Object.values(groups).forEach((group: any) => {
            const params = templateParams.map(p => {
                const mapping = paramMappings[p];
                if (!mapping) return '';
                if (mapping === 'CUSTOM_STATIC') return paramMappings[`${p}_static`] || '';

                // Check for Merge Column match
                if (mapping === sumColumn) {
                    if (duplicateMode === 'sum') return group._sumTotal.toString();
                    if (duplicateMode === 'list') return group._values.join(', ');
                }

                // Check for Date Range Mapping
                if (duplicateMode === 'sum' && mapping === dateCol && dateCol) {
                    if (group._dates.length > 0) {
                        const sorted = group._dates.sort((a: Date, b: Date) => a.getTime() - b.getTime());
                        const first = sorted[0].toLocaleDateString('en-GB');
                        const last = sorted[sorted.length - 1].toLocaleDateString('en-GB');
                        return first === last ? first : `${first} - ${last}`;
                    }
                    return '';
                }

                const colIndex = headers.indexOf(mapping);
                return colIndex >= 0 ? (group.row[colIndex] || '') : '';
            });

            validList.push({
                phone: group.phone,
                email: group.email,
                params: params
            });
        });
    }

    return { validList, invCount };
}
