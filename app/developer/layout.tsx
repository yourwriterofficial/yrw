export const metadata = {
  icons: {
    icon: [{ url: '/developa/favicon.ico', sizes: '32x32 48x48' }, { url: '/developa/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/developa/apple-touch-icon.png', sizes: '180x180' }],
  },
  manifest: '/developa/manifest.json',
  title: { absolute: 'developa.me | Create a website without coding experience' },
  description: 'Create your online store or community on developa.me. Pick a template, add products, get paid online, and connect your own domain. No coding needed.',
};

export default function DeveloperLayout({ children }: { children: React.ReactNode }) {
  return children;
}
