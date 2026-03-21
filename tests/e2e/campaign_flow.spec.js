const { test, expect } = require('@playwright/test');

test('Campaign Creation Flow', async ({ page }) => {
    // 1. Visit Home
    await page.goto('/');
    await expect(page).toHaveTitle(/WhatsFlow/);

    // 2. Click "New Campaign"
    // Assuming there is a link or button. If not, we might need to update UI or use text locator.
    // The sidebar usually has "New Campaign".
    await page.getByText('New Campaign').click();

    // 3. Fill Form
    await expect(page.getByText('Campaign Details')).toBeVisible();
    await page.getByPlaceholder('e.g. Donor Thank You').fill('E2E Test Campaign');

    // 4. Select Template (Mocked logic or relying on empty state)
    // Since real backend might not have templates without keys, we check if we can proceed.
    // If no templates, we expect "No templates found".
    // This test validates that the UI renders and interacts.

    // Verify "Cancel" button exists
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();

    // Verify "Next" is disabled initially
    await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();
});
