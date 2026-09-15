'use client';
import ServiceOrderPage from '@/app/components/ServiceOrderPage';
import { Terminal } from 'lucide-react';

export default function DevOrderForm() {
  return (
    <ServiceOrderPage
      serviceCategory="DEV"
      pageKey="order_dev"
      orderPrefix="DEV"
      tosKey="dev_tos"
      accent="cyan"
      icon={Terminal}
      layoutVariant="studio"
      vaultStatusDefault="Pending Tech Analysis"
      topicLabel="System / Project Objective"
      topicPlaceholder="E.g., Multi-tenant SaaS dashboard with automated billing & customer portal"
      briefLabel="Technical Architecture / Wireframes / Reference Files"
      briefHelperText="Attach Architecture Specs, Schema Diagrams or Wireframes (PDF, ZIP, PNG)"
      minProposedBudget={50000}
      additionalInfoLabel="Key Features, Third-Party Integrations & Notes"
      extraFields={[
        {
          type: 'select',
          key: 'platform',
          label: 'Primary Platform & Architecture',
          options: [
            'Web Application (React / Next.js SaaS & Admin)',
            'Mobile Application (iOS & Android)',
            'Full Stack Web & Mobile Ecosystem',
            'Backend REST / GraphQL API & Database Architecture',
            'Rapid MVP Prototype (Validation Build)',
            'Automation Script / Custom Internal Tooling',
          ],
          defaultValue: 'Web Application (React / Next.js SaaS & Admin)',
        },
        {
          type: 'select',
          key: 'tech_stack_preference',
          label: 'Preferred Tech Stack',
          options: [
            'Next.js, React & Tailwind CSS',
            'Node.js / Express / NestJS',
            'Python / FastAPI / Django',
            'React Native (Mobile)',
            'PostgreSQL & Supabase Architecture',
            'Recommend the best stack for my requirements',
          ],
          defaultValue: 'Next.js, React & Tailwind CSS',
        },
        {
          type: 'text',
          key: 'figma_or_repo_url',
          label: 'Figma URL or Existing Repository (Optional)',
          placeholder: 'https://figma.com/file/... or https://github.com/...',
          helperText: 'Provide a link to designs, wireframes, user stories, or your current codebase if applicable.',
        },
        {
          type: 'select',
          key: 'deployment_target',
          label: 'Target Hosting & Deployment',
          options: [
            'Vercel / Cloudflare Edge (Recommended for Web)',
            'AWS / DigitalOcean / Dedicated Cloud',
            'Supabase Cloud / Managed PostgreSQL',
            'Apple App Store & Google Play Store',
            'Configure staging only, we will deploy internally',
          ],
          defaultValue: 'Vercel / Cloudflare Edge (Recommended for Web)',
        },
      ]}
    />
  );
}
