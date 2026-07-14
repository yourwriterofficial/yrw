// Default copy for every admin-editable page. These are the "factory" values shown when no
// override exists in `page_settings`, and what the admin Pages editor restores to on request.

export interface OrderPageContent {
  hero: { badge: string; title: string; subtitle: string };
  budget_note: { title: string; text: string };
}

export const ORDER_PAGE_DEFAULTS: Record<string, OrderPageContent> = {
  order_academic: {
    hero: {
      badge: 'Research & Academic Writing',
      title: 'Academic Writing, Done Right',
      subtitle: 'Essays, theses, and dissertations — priced per word, with plagiarism and AI-originality reports on every order.',
    },
    budget_note: {
      title: 'Working with a tighter budget?',
      text: "If none of the plans above fit what you've budgeted, choose Propose Your Own Budget below — tell us your number and scope, and our team will confirm what's achievable before any work begins.",
    },
  },
  order_content: {
    hero: {
      badge: 'Content & Creative Writing',
      title: 'Content & Creative Writing',
      subtitle: 'Website copy, eBooks, SEO articles, and brand storytelling — matched to your tone and audience.',
    },
    budget_note: {
      title: 'Need something outside these packages?',
      text: 'If the packages above are more than you planned to spend, propose your own budget and scope — our team will review it and confirm what we can deliver.',
    },
  },
  order_dev: {
    hero: {
      badge: 'Full Stack & Custom Software',
      title: 'Full Stack & Custom Software',
      subtitle: 'Web apps, APIs, database architecture, and MVP builds — delivered with complete source code and IP transfer.',
    },
    budget_note: {
      title: 'Working with a fixed budget?',
      text: 'If the packages above exceed what you have to spend, propose your own budget and describe the scope — our engineering team will confirm feasibility before starting.',
    },
  },
  order_resume: {
    hero: {
      badge: 'Executive Resumes & CVs',
      title: 'Executive Resumes & CVs',
      subtitle: 'ATS-optimized resumes, cover letters, and LinkedIn overhauls designed to secure interviews.',
    },
    budget_note: {
      title: 'Have a specific budget in mind?',
      text: 'If these packages cost more than you planned, propose your own budget below — we will confirm exactly what fits before beginning work.',
    },
  },
  order_statistics: {
    hero: {
      badge: 'Statistics, Maths, Financial & Fieldwork',
      title: 'Statistics, Maths, Financial & Fieldwork',
      subtitle: 'SPSS and statistical analysis, mathematical modelling, financial computation, and fieldwork — scoped and priced to your project.',
    },
    budget_note: {
      title: 'Is your budget below these packages?',
      text: 'If the packages above are greater than your budget, propose your own — describe your project and what you can spend, and our team will confirm what is achievable.',
    },
  },
};

export interface HomeWhyUsItem { icon: string; title: string; text: string }
export interface HomeFaqItem { q: string; a: string }

export interface HomePageContent {
  hero: { badge: string; title_prefix: string; title_highlight_1: string; title_mid: string; title_highlight_2: string; subtitle: string };
  trust_bar: string[];
  why_us: HomeWhyUsItem[];
  faqs: HomeFaqItem[];
}

export const HOME_PAGE_DEFAULTS: HomePageContent = {
  hero: {
    badge: 'Academic Research, Software & Career Services',
    title_prefix: 'The work gets done.',
    title_highlight_1: 'Properly',
    title_mid: '',
    title_highlight_2: 'researched. Fully documented.',
    subtitle: 'Dissertations and statistical analysis, production-grade software, executive resumes, and creative content — scoped up front, tracked to a deadline, and released only when your payment terms are met.',
  },
  trust_bar: [
    '4-hour ready-made delivery',
    'Full source code on every dev order',
    'Encrypted vault delivery',
    'Milestone-based payments',
  ],
  why_us: [
    { icon: 'Shield', title: 'Vault Security', text: 'Every document is encrypted. Final deliverables stay locked until your payment balance is cleared.' },
    { icon: 'CheckCircle2', title: 'Plagiarism Free', text: 'Custom writing runs through advanced originality scanners and ships with verifiable AI/similarity reports.' },
    { icon: 'Clock', title: 'On-Time Delivery', text: 'Deadlines are tracked live in your dashboard, with real-time countdown visibility from day one.' },
    { icon: 'Award', title: 'Flexible Payments', text: 'Pay upfront, in milestones, or from your wallet balance — whichever structure fits your budget.' },
  ],
  faqs: [
    { q: 'How fast is delivery?', a: 'Ready-made project materials are delivered within 4 hours. Custom writing, resumes, and software are scoped to a deadline you set when you submit your brief.' },
    { q: 'Is the ready-made project catalogue plagiarism-checked?', a: "No — those are pre-written materials delivered as-is, without a plagiarism or AI-detection guarantee. If you need a plagiarism-free, AI-free custom write-up, use our Academic Writing service instead." },
    { q: 'Can I pay in installments?', a: 'Yes. Custom academic, content, resume, and software orders support milestone-based payment plans — a deposit followed by a balance, or a custom schedule for larger software builds.' },
    { q: 'Is my payment and data secure?', a: 'Payments are processed through Paystack. Every final deliverable is encrypted and stays locked in your Secure Vault until your balance is fully cleared.' },
    { q: 'Do I get full source code for software projects?', a: 'Yes — complete source code and IP transfer are included for custom development orders and every script purchased from the Dev Shop marketplace.' },
    { q: "What if my exact topic isn't in the catalogue?", a: 'Search the ready-made catalogue for availability first — if nothing matches, submit a custom brief and a writer will produce it from scratch.' },
  ],
};
