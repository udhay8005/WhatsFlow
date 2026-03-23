// File: excelParser.ts
// Module: frontend/src/utils
// Description: Parses uploaded Excel (.xlsx) and CSV files into a normalized
//              row/header structure suitable for campaign contact import.
//              Uses the `read-excel-file` package (replaces vulnerable `xlsx`
//              v0.18.5 which had Prototype Pollution GHSA-4r6h-8v6p-xvw6 and
//              ReDoS GHSA-5pgg-2g8v-p5x9 with no upstream fix available).
// Author: Senior Dev Architect
// Created: 2026-03-22
// Dependencies: read-excel-file

// read-excel-file exposes named sub-paths only (no bare "." export).
// Use the /browser sub-path which matches Vite's browser target and the
// jsdom test environment used by Vitest.
import readXlsxFile from 'read-excel-file/browser';

/**
 * Normalizes a phone number to WhatsApp format (digits only, with country code).
 *
 * @param input   - The raw phone number as a string or number.
 * @param defaultCC - Two-or-more digit country code to prepend when the number
 *                    has exactly 10 digits (assumed to be a local number).
 *                    Defaults to "91" (India).
 * @returns Digits-only string with country code, or an empty string for
 *          falsy input.
 */
export function normalizePhoneNumber(input: string | number, defaultCC: string = "91"): string {
    if (!input) return "";
    let str = String(input).trim();

    // Remove all non-digits
    let digits = str.replace(/\D/g, '');

    // Remove leading zeros
    digits = digits.replace(/^0+/, '');

    // Inject Country Code if missing (Assuming 10 digit is local number)
    if (digits.length === 10) {
        digits = defaultCC + digits;
    }

    return digits;
}

/** Shape returned by parseExcelFile. */
export interface ParsedData {
    headers: string[];
    rows: any[][];
}

/**
 * Reads a File as a UTF-8 text string using the FileReader API.
 *
 * `File.prototype.text()` (the Blob stream API) is not available in jsdom,
 * so we always use FileReader which works in both real browsers and jsdom.
 *
 * @param file - The File to read.
 * @returns Promise that resolves with the file's text content.
 */
function readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            if (e.target?.result != null) {
                resolve(e.target.result as string);
            } else {
                reject(new Error("Failed to read file. The file may be corrupted or empty."));
            }
        };
        reader.onerror = () => reject(new Error("File reading failed. Please try again or use a different file."));
        reader.readAsText(file, 'utf-8');
    });
}

/**
 * Parses an RFC-4180-compliant CSV string into a 2-D array of strings.
 *
 * Uses a character-by-character state machine so that quoted fields
 * containing embedded newlines (allowed by RFC-4180 §2.6) are handled
 * correctly. The previous line-split approach broke those fields.
 *
 * Handles:
 *   - Fields wrapped in double-quotes
 *   - Escaped double-quotes inside quoted fields ("")
 *   - Quoted fields that span multiple lines (embedded \n / \r\n)
 *   - CRLF and LF line endings
 *   - Blank / all-whitespace rows (skipped)
 *
 * @param text - Raw file text content.
 * @returns Array of rows, each row being an array of cell strings.
 */
function parseCSV(text: string): any[][] {
    const rows: any[][] = [];
    let currentRow: string[] = [];
    let currentCell = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const next = text[i + 1];

        if (inQuotes) {
            if (ch === '"' && next === '"') {
                // Escaped double-quote inside a quoted field ("" → ")
                currentCell += '"';
                i++;
            } else if (ch === '"') {
                // Closing quote — exit quoted mode
                inQuotes = false;
            } else {
                // Any character, including embedded newlines, belongs to the cell
                currentCell += ch;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
            } else if (ch === ',') {
                currentRow.push(currentCell);
                currentCell = '';
            } else if (ch === '\r' && next === '\n') {
                // CRLF end-of-row
                currentRow.push(currentCell);
                currentCell = '';
                if (currentRow.some(c => c.trim() !== '')) rows.push(currentRow);
                currentRow = [];
                i++; // consume the \n
            } else if (ch === '\n') {
                // LF end-of-row
                currentRow.push(currentCell);
                currentCell = '';
                if (currentRow.some(c => c.trim() !== '')) rows.push(currentRow);
                currentRow = [];
            } else {
                currentCell += ch;
            }
        }
    }

    // Flush the last row (file may not end with a newline)
    if (currentCell !== '' || currentRow.length > 0) {
        currentRow.push(currentCell);
        if (currentRow.some(c => c.trim() !== '')) rows.push(currentRow);
    }

    return rows;
}

/**
 * Parses an Excel (.xlsx / .xls) or CSV file and returns its contents as a
 * normalized header + rows structure.
 *
 * - Excel files are parsed with `read-excel-file` (safe, audited alternative
 *   to the removed `xlsx` package).
 * - CSV files are parsed with a built-in RFC-4180 parser that avoids any
 *   third-party dependency with a ReDoS surface.
 *
 * @param file - A browser `File` object (from an <input type="file"> element).
 * @returns Resolves with `{ headers, rows }` where `headers` is the first row
 *          trimmed to strings and `rows` is every subsequent row.
 * @throws Error if the file is empty, contains only a header row, or cannot
 *         be parsed.
 */
export const parseExcelFile = async (file: File): Promise<ParsedData> => {
    const extension = file.name.split('.').pop()?.toLowerCase();

    let allRows: any[][];

    if (extension === 'csv') {
        // Parse CSV via FileReader (works in real browsers and jsdom alike).
        // We intentionally avoid File.prototype.text() because jsdom does not
        // bridge that Blob stream API into the window environment.
        const text = await readFileAsText(file);
        allRows = parseCSV(text);
    } else {
        // Parse Excel (.xlsx, .xls) using read-excel-file.
        // read-excel-file returns Row[] where each cell is already typed
        // (string | number | boolean | Date | null). Null cells are
        // normalised to "" so downstream code never sees null.
        const rows = await readXlsxFile(file);
        allRows = rows.map(row => row.map(cell => cell ?? ""));
    }

    if (allRows.length === 0) throw new Error("File is empty");
    if (allRows.length === 1) throw new Error("File has headers but no data rows");

    const headers = allRows[0].map((h: any) => String(h).trim());
    const rows = allRows.slice(1);

    return { headers, rows };
};
