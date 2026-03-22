// File: excelParser.test.ts
// Module: frontend/src/utils/__tests__
// Description: Unit tests for excelParser utilities.
//              Mocks `read-excel-file` (replaced vulnerable `xlsx` v0.18.5).
// Author: Senior Dev Architect
// Created: 2026-03-22
// Dependencies: vitest, read-excel-file (mocked)

import { normalizePhoneNumber, parseExcelFile } from '../excelParser';
import { describe, it, expect, vi } from 'vitest';
import readXlsxFile from 'read-excel-file/browser';

// Mock read-excel-file/browser so tests never touch the real parser or the
// filesystem. The sub-path must match exactly what excelParser.ts imports.
vi.mock('read-excel-file/browser', () => ({
    default: vi.fn(() => Promise.resolve([
        ['Name', 'Phone'],
        ['Alice', '1234567890']
    ]))
}));

// ---------------------------------------------------------------------------
// normalizePhoneNumber
// ---------------------------------------------------------------------------
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

        it('should return empty string for falsy input', () => {
            expect(normalizePhoneNumber('')).toBe('');
        });

        it('should strip leading zeros', () => {
            // 10 digits after stripping leading zero → country code is injected
            expect(normalizePhoneNumber('09876543210')).toBe('919876543210');
        });
    });

    // -------------------------------------------------------------------------
    // parseExcelFile — Excel path (mocked via read-excel-file)
    // -------------------------------------------------------------------------
    describe('parseExcelFile', () => {
        it('should parse an xlsx file and return headers and rows', async () => {
            const mockFile = new File([''], 'test.xlsx', {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });

            const result = await parseExcelFile(mockFile);

            expect(result.headers).toEqual(['Name', 'Phone']);
            expect(result.rows).toEqual([['Alice', '1234567890']]);
            // Confirm the safe library was invoked (not the removed xlsx package)
            expect(readXlsxFile).toHaveBeenCalledWith(mockFile);
        });

        // -------------------------------------------------------------------------
        // parseExcelFile — CSV path (built-in parser, no mock needed)
        // -------------------------------------------------------------------------
        it('should parse a CSV file using the built-in parser', async () => {
            const csvContent = 'Name,Phone\nBob,9876543210';
            const mockCsvFile = new File([csvContent], 'contacts.csv', { type: 'text/csv' });

            const result = await parseExcelFile(mockCsvFile);

            expect(result.headers).toEqual(['Name', 'Phone']);
            expect(result.rows).toEqual([['Bob', '9876543210']]);
        });

        it('should handle quoted CSV fields containing commas', async () => {
            const csvContent = '"Last, First",Phone\n"Doe, John",9876543210';
            const mockCsvFile = new File([csvContent], 'contacts.csv', { type: 'text/csv' });

            const result = await parseExcelFile(mockCsvFile);

            expect(result.headers).toEqual(['Last, First', 'Phone']);
            expect(result.rows).toEqual([['Doe, John', '9876543210']]);
        });

        it('should throw when xlsx file has no rows', async () => {
            // Override mock for this single test to return an empty array
            vi.mocked(readXlsxFile).mockResolvedValueOnce([]);

            const mockFile = new File([''], 'empty.xlsx', {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });

            await expect(parseExcelFile(mockFile)).rejects.toThrow('File is empty');
        });

        it('should throw when xlsx file has only a header row', async () => {
            vi.mocked(readXlsxFile).mockResolvedValueOnce([['Name', 'Phone']]);

            const mockFile = new File([''], 'headers-only.xlsx', {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });

            await expect(parseExcelFile(mockFile)).rejects.toThrow('File has headers but no data rows');
        });

        it('should throw when CSV file is empty', async () => {
            const mockCsvFile = new File([''], 'empty.csv', { type: 'text/csv' });
            await expect(parseExcelFile(mockCsvFile)).rejects.toThrow('File is empty');
        });

        it('should throw when CSV file has only a header row', async () => {
            const mockCsvFile = new File(['Name,Phone'], 'headers-only.csv', { type: 'text/csv' });
            await expect(parseExcelFile(mockCsvFile)).rejects.toThrow('File has headers but no data rows');
        });
    });
});
