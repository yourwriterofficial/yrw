import ThreadView from '@/app/components/forums/ThreadView';

export default async function ForumThreadPage({
  params,
}: {
  params: Promise<{ slug: string; threadId: string }>;
}) {
  const { slug, threadId } = await params;
  return <ThreadView slug={slug} threadId={threadId} />;
}
