import ManageView from './ManageView';

export const metadata = {
  title: 'Manage your sites | developa.me',
  description: 'Manage your developa.me store or community: products, orders, discussions, your own domain and your plan.',
  robots: { index: false },
};

export default function ManagePage() {
  return <ManageView />;
}
