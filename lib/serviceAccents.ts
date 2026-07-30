export type ServiceSlug = 'academic' | 'content' | 'resume' | 'statistics' | 'dev';

export interface ServiceAccent {
  label: string;
  slug: ServiceSlug;
  href: string;
  iconName: string;
  badge: string;
  color: string;
  bg: string;
  border: string;
  lightColor: string;
  gradient: string;
}

export const SERVICE_ACCENTS: ServiceAccent[] = [
  {
    label: 'Academic Writing & Research',
    slug: 'academic',
    href: '/academic-writing',
    iconName: 'BookOpen',
    badge: 'Research Pipeline',
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    lightColor: 'text-emerald-400',
    gradient: 'from-emerald-500 to-teal-400',
  },
  {
    label: 'Statistics & Fieldwork',
    slug: 'statistics',
    href: '/statistics-fieldwork',
    iconName: 'LineChart',
    badge: 'Quantitative analysis',
    color: 'text-purple-500',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    lightColor: 'text-purple-400',
    gradient: 'from-purple-500 to-violet-400',
  },
  {
    label: 'Content & Creative Writing',
    slug: 'content',
    href: '/content-writing',
    iconName: 'PenTool',
    badge: 'SaaS & Marketing Copy',
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    lightColor: 'text-amber-400',
    gradient: 'from-amber-500 to-orange-400',
  },
  {
    label: 'Executive CVs & Resumes',
    slug: 'resume',
    href: '/resume-cv',
    iconName: 'Briefcase',
    badge: 'Career acceleration',
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    lightColor: 'text-blue-400',
    gradient: 'from-blue-500 to-sky-400',
  },
  {
    label: 'Full Stack Development',
    slug: 'dev',
    href: '/developer',
    iconName: 'Terminal',
    badge: 'Engineering',
    color: 'text-cyan-500',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
    lightColor: 'text-cyan-400',
    gradient: 'from-cyan-500 to-blue-400',
  },
];

export const SERVICE_BY_SLUG: Record<ServiceSlug, ServiceAccent> = SERVICE_ACCENTS.reduce(
  (acc, s) => ({ ...acc, [s.slug]: s }),
  {} as Record<ServiceSlug, ServiceAccent>
);
