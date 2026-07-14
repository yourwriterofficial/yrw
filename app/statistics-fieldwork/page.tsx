import ServiceLandingTemplate from '@/app/components/ServiceLandingTemplate';
import { LineChart, BarChart3, ClipboardList, Presentation, Sliders, Zap } from 'lucide-react';

export const metadata = {
  title: 'Statistics, Maths, Financial & Fieldwork | ResearchWriter',
  description: 'For large-scale projects requiring custom add-ons — SPSS and statistical analysis, mathematical modelling, financial computation, fieldwork, and survey gathering.',
};

export default function StatisticsFieldworkPage() {
  return (
    <ServiceLandingTemplate
      accent="purple"
      badgeLabel="Statistics, Maths, Financial & Fieldwork"
      icon={LineChart}
      title="Statistics, Maths, Financial & Fieldwork"
      description="For large-scale projects requiring custom add-ons — SPSS and statistical analysis, mathematical modelling, financial computation, fieldwork, and survey gathering, priced to scope."
      ctaHref="/order/statistics"
      ctaLabel="Start Your Order"
      bullets={['Add-on toggles (Slides, Data)', 'Bespoke emergency pricing', 'Large-scale project management']}
      capabilitiesTitle="What We Handle"
      capabilitiesDescription="Built for projects that outgrow a standard order form."
      capabilities={[
        { icon: BarChart3, title: 'SPSS & Statistical Analysis', description: 'Data cleaning, hypothesis testing, and full statistical write-ups.' },
        { icon: ClipboardList, title: 'Fieldwork & Survey Gathering', description: 'Questionnaire design and real-world data collection support.' },
        { icon: Presentation, title: 'PowerPoint Summaries', description: 'Defense-ready slide decks summarizing your findings.' },
        { icon: Sliders, title: 'Custom Add-on Toggles', description: 'Mix and match services as your project scope evolves.' },
        { icon: Zap, title: 'Bespoke Emergency Pricing', description: 'Rush turnaround available for time-sensitive submissions.' },
        { icon: LineChart, title: 'Large-Scale Project Management', description: 'Dedicated tracking for multi-phase or multi-deliverable work.' },
      ]}
      processSteps={[
        { title: 'Submit Brief', description: 'Describe your project scope and required add-ons.' },
        { title: 'Custom Quote', description: 'Receive bespoke pricing scoped to your specific requirements.' },
        { title: 'Work in Progress', description: 'Track each phase and add-on through your dashboard.' },
        { title: 'Vault Delivery', description: "Every deliverable lands securely in your vault as it's completed." },
      ]}
    />
  );
}
