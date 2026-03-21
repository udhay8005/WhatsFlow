import { normalizePhoneNumber, parseExcelFile } from '../excelParser';
import { describe, it, expect, vi } from 'vitest';
import * as XLSX from 'xlsx';

// Mock XLSX
vi.mock('xlsx', () => {
    return {
        read: vi.fn(() => ({
            SheetNames: ['Sheet1'],
            Sheets: { 'Sheet1': {} }
        })),
        utils: {
            sheet_to_json: vi.fn(() => [
                ['Name', 'Phone'],
                ['Alice', '1234567890']
            ])
        }
    };
});

describe('excelParser', () => {
    describe('normalizePhoneNumber', () => {
        it('should strip non-digits', () => {
            expect(normalizePhoneNumber('+1 (234) 567-8900')).toBe('12345678900');
        });

        it('should add default country code to 10-digit numbers', () => {
            expect(normalizePhoneNumber('9876543210')).toBe('919876543210');
        });

        it('should accept custom country code', () => {
            expect(normalizePhoneNumber('9876543210', '1')).toBe('19876543210');
        });
    });

    describe('parseExcelFile', () => {
        it('should parse file data correctly', async () => {
            // Mock FileReader
            const mockFile = new File([''], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

            // We need to bypass the actual FileReader logic since it's hard to trigger in JSDOM consistently without real files.
            // Or we specifically test that it calls XLSX.read.

            // To make this testable without a real browser environment emitting 'load' events perfectly, 
            // we rely on JSDOM's FileReader implementation which usually works enough with basic blobs.

            const result = await parseExcelFile(mockFile);

            expect(result.headers).toEqual(['Name', 'Phone']);
            expect(result.rows).toEqual([['Alice', '1234567890']]);
            expect(XLSX.read).toHaveBeenCalled();
        });
    });
});
