import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CampaignDetailsStep from '../campaign/CampaignDetailsStep';

describe('CampaignDetailsStep', () => {
    const defaultProps = {
        campaignName: '',
        setCampaignName: vi.fn(),
        templateId: '',
        setTemplateId: vi.fn(),
        templates: [
            { name: 'template_1', status: 'APPROVED', language: 'en' },
            { name: 'template_2', status: 'APPROVED', language: 'es' }
        ],
        loadingTemplates: false,
        mediaFile: null,
        setMediaFile: vi.fn(),
        mediaPreview: null,
        setMediaPreview: vi.fn(),
        mediaId: null,
        setMediaId: vi.fn(),
        mediaType: null,
        setMediaType: vi.fn(),
        uploadingMedia: false,
        handleMediaUpload: vi.fn(),
        onNext: vi.fn(),
        onBack: vi.fn()
    };

    it('should render form fields correctly', () => {
        render(<CampaignDetailsStep {...defaultProps} />);

        expect(screen.getByText('Campaign Name')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('e.g. Donor Thank You - January')).toBeInTheDocument();
        expect(screen.getByText('Template')).toBeInTheDocument();
        expect(screen.getByText('Select a template...')).toBeInTheDocument();
    });

    it('should update campaign name on input', () => {
        render(<CampaignDetailsStep {...defaultProps} />);

        const input = screen.getByPlaceholderText('e.g. Donor Thank You - January');
        fireEvent.change(input, { target: { value: 'New Campaign' } });

        expect(defaultProps.setCampaignName).toHaveBeenCalledWith('New Campaign');
    });

    it('should open dropdown and select template', () => {
        render(<CampaignDetailsStep {...defaultProps} />);

        // Open Dropdown
        const dropdownTrigger = screen.getByText('Select a template...');
        fireEvent.click(dropdownTrigger);

        // Check options visible
        expect(screen.getByText('template_1')).toBeInTheDocument();
        expect(screen.getByText('template_2')).toBeInTheDocument();

        // Select Option
        fireEvent.click(screen.getByText('template_1'));

        expect(defaultProps.setTemplateId).toHaveBeenCalledWith('template_1');
    });

    it('should show loading state for templates', () => {
        render(<CampaignDetailsStep {...defaultProps} loadingTemplates={true} />);
        expect(screen.getByText('Loading templates...')).toBeInTheDocument();
    });

    it('should disable Next button if form is incomplete', () => {
        render(<CampaignDetailsStep {...defaultProps} />);
        const nextButton = screen.getByText('Next: Upload Contacts');
        expect(nextButton).toBeDisabled();
    });

    it('should enable Next button if form is complete', () => {
        render(<CampaignDetailsStep {...defaultProps} campaignName="Test" templateId="template_1" />);
        const nextButton = screen.getByText('Next: Upload Contacts');
        expect(nextButton).not.toBeDisabled();
    });

    it('should call onNext when clicked', () => {
        render(<CampaignDetailsStep {...defaultProps} campaignName="Test" templateId="template_1" />);
        const nextButton = screen.getByText('Next: Upload Contacts');
        fireEvent.click(nextButton);
        expect(defaultProps.onNext).toHaveBeenCalled();
    });
});
