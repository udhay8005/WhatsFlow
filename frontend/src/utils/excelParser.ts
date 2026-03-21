import * as XLSX from 'xlsx';

/**
 * Normalizes phone number to WhatsApp format (digits only, country code).
 * @param input The input phone number
 * @param defaultCC Default country code
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

export interface ParsedData {
    headers: string[];
    rows: any[][];
}

/**
 * Parses Excel/CSV file and returns normalized rows.
 * @param file The file to parse
 */
export const parseExcelFile = (file: File): Promise<ParsedData> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                if (!e.target?.result) {
                    throw new Error("Failed to read file. The file may be corrupted or empty.");
                }

                const data = new Uint8Array(e.target.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array', cellDates: true });

                // Get first sheet
                const sheetName = workbook.SheetNames[0];
                if (!sheetName) {
                    throw new Error("The file appears to be empty or has no valid sheets.");
                }
                const worksheet = workbook.Sheets[sheetName];

                // Convert to JSON
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" }) as any[][];

                if (jsonData.length === 0) throw new Error("File is empty");
                if (jsonData.length === 1) throw new Error("File has headers but no data rows");

                const headers = jsonData[0].map((h: any) => String(h).trim());
                const rows = jsonData.slice(1);

                resolve({ headers, rows });
            } catch (err) {
                reject(err);
            }
        };

        reader.onerror = () => reject(new Error("File reading failed. Please try again or use a different file."));
        reader.readAsArrayBuffer(file);
    });
};
