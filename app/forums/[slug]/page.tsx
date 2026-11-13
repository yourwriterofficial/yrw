import ForumView from '@/app/components/forums/ForumView';

export default async function ForumSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <ForumView slug={slug} />;
}
