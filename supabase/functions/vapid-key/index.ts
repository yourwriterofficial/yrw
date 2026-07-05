// Returns the VAPID public key so the frontend never needs it baked into the build.
// The actual key is stored as a Supabase secret (VAPID_PUBLIC_KEY) — safe to expose, it's public.
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
  if (!publicKey) {
    return new Response(JSON.stringify({ error: "VAPID_PUBLIC_KEY secret not set" }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ publicKey }), {
    headers: {
      ...CORS,
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
});
