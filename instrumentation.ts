/** Next.js calls this for every unexpected error on the server. See lib/errorAlert.ts for what is (and is not) sent. */
export async function onRequestError(
  err: unknown,
  request: { path: string; method: string },
  context: { routePath?: string; routeType?: string }
) {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { reportServerError } = await import('./lib/errorAlert');
  await reportServerError(err, request, context);
}
