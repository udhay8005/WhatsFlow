import { describe, it, expect } from 'vitest';
import { filterContacts, processContactList } from './contactProcessor';

// Mock Data
const HEADERS = ['Name', 'Phone', 'Amount', 'Date'];
const RAW_ROWS = [
    ['Alice', '9876543210', '100', '2023-01-01'], // Row 2 (Index 0)
    ['Bob', '9876543211', '200', '2023-01-02'],   // Row 3 (Index 1)
    ['Alice', '9876543210', '300', '2023-01-03'], // Row 4 (Index 2) - Duplicate Phone
    ['Carol', 'invalid', '400', '2023-01-04'],    // Row 5 (Index 3) - Invalid Phone
];

describe('contactProcessor', () => {

    describe('filterContacts', () => {
        it('should filter by row range (inclusive)', () => {
            const result = filterContacts(RAW_ROWS, {
                filterType: 'rows',
                filterRange: { start: '3', end: '4' }, // Should keep Bob and Alice(2)
                headers: HEADERS
            });
            // Row 3 is Index 1, Row 4 is Index 2
            expect(result).toHaveLength(2);
            expect(result[0].row[0]).toBe('Bob');
            expect(result[1].row[0]).toBe('Alice');
        });

        it('should filter by date range', () => {
            const result = filterContacts(RAW_ROWS, {
                filterType: 'date',
                filterRange: { start: '2023-01-02', end: '2023-01-02' },
                dateCol: 'Date',
                headers: HEADERS
            });
            expect(result).toHaveLength(1);
            expect(result[0].row[0]).toBe('Bob');
        });

        it('should exclude manually deselected rows', () => {
            const result = filterContacts(RAW_ROWS, {
                filterType: 'all',
                filterRange: { start: '', end: '' },
                headers: HEADERS,
                excludedRowIndices: new Set([0]) // Exclude first Alice
            });
            expect(result).toHaveLength(3);
            expect(result[0].row[0]).toBe('Bob');
        });
    });

    describe('processContactList', () => {
        const FILTERED_ALL = RAW_ROWS.map((row, index) => ({ row, index }));

        it('should process "keep" mode (Separate Messages)', () => {
            const { validList, invCount } = processContactList(FILTERED_ALL, {
                phoneCol: 'Phone',
                duplicateMode: 'keep',
                templateParams: ['1'],
                paramMappings: { '1': 'Name' },
                headers: HEADERS
            });

            // Alice(1), Bob, Alice(2) -> 3 valid. Carol invalid.
            expect(validList).toHaveLength(3);
            expect(invCount).toBe(1);
            // Verify E.164
            expect(validList[0].phone).toBe('+919876543210');
        });

        it('should process "sum" mode (Aggregate Amount)', () => {
            // Should merge Alice's two rows
            const { validList } = processContactList(FILTERED_ALL, {
                phoneCol: 'Phone',
                duplicateMode: 'sum',
                sumColumn: 'Amount',
                templateParams: ['1'],
                paramMappings: { '1': 'Amount' }, // Map param 1 to the aggregated Sum
                headers: HEADERS
            });

            expect(validList).toHaveLength(2); // Alice + Bob
            const alice = validList.find(c => c.phone === '+919876543210');
            expect(alice).toBeDefined();
            // Params[0] should be sum: 100 + 300 = 400
            expect(alice.params[0]).toBe('400');
        });

        it('should process "list" mode (Concatenate Values)', () => {
            const { validList } = processContactList(FILTERED_ALL, {
                phoneCol: 'Phone',
                duplicateMode: 'list',
                sumColumn: 'Amount',
                templateParams: ['1'],
                paramMappings: { '1': 'Amount' },
                headers: HEADERS
            });

            const alice = validList.find(c => c.phone === '+919876543210');
            // Params[0] should be list: "100, 300" 
            // Note: Since no Date Col selected, just values
            expect(alice.params[0]).toBe('100, 300');
        });

        it('should format date range in "sum" mode if Date mapped', () => {
            const { validList } = processContactList(FILTERED_ALL, {
                phoneCol: 'Phone',
                duplicateMode: 'sum',
                sumColumn: 'Amount',
                dateCol: 'Date', // Selected
                templateParams: ['1'],
                paramMappings: { '1': 'Date' }, // Map param to Date Col (which becomes Range)
                headers: HEADERS
            });

            const alice = validList.find(c => c.phone === '+919876543210');
            // Alice dates: 01/01 and 03/01. Range: 01/01/2023 - 03/01/2023
            // Format depends on locale in code: en-GB (DD/MM/YYYY)
            expect(alice.params[0]).toBe('01/01/2023 - 03/01/2023');
        });
    });

});
