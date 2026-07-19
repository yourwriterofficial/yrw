// Image upload proxy.
//
// The browser never talks to the Apps Script Web App directly — that URL also
// sends email (see send-order-email), so leaking it would let anyone send mail
// as us and dump files in our Drive. It stays server-side as the
// GOOGLE_APPS_SCRIPT_URL secret (the same one send-order-email already uses)
// and this function forwards the upload.
// verify_jwt is on, so only signed-in users can reach it.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

// Keep in step with the client-side resize (max ~100KB); this is a backstop
// against someone posting a huge payload straight at the function.
const MAX_BASE64_CHARS = 2_000_000; // ~1.5MB decoded

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const appsScriptUrl = Deno.env.get("GOOGLE_APPS_SCRIPT_URL");
  if (!appsScriptUrl) {
    return json({ error: "Image upload is not configured (GOOGLE_APPS_SCRIPT_URL is unset)." }, 503);
  }

  let payload: { filename?: string; mimeType?: string; base64?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { filename, mimeType, base64 } = payload;
  if (!base64) return json({ error: "Missing base64 image data" }, 400);
  if (base64.length > MAX_BASE64_CHARS) return json({ error: "Image too large" }, 413);
  if (mimeType && !mimeType.startsWith("image/")) return json({ error: "Only image uploads are allowed" }, 415);

  try {
    const res = await fetch(appsScriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: filename || "upload.jpg",
        mimeType: mimeType || "image/jpeg",
        base64,
      }),
    });

    const text = await res.text();
    if (!res.ok) {
      console.error("Apps Script upload failed", res.status, text.slice(0, 200));
      return json({ error: `Upload service returned ${res.status}` }, 502);
    }

    // Apps Script returns JSON, but an auth/deploy misconfiguration makes it
    // serve an HTML login page with a 200 — so parsing is what actually tells
    // us whether the upload worked.
    let result: { url?: string; error?: string };
    try {
      result = JSON.parse(text);
    } catch {
      console.error("Apps Script returned non-JSON (check Web App access is 'Anyone')", text.slice(0, 200));
      return json({ error: "Upload service returned an unexpected response. Check the Apps Script deployment access setting." }, 502);
    }

    if (!result.url) return json({ error: result.error || "Upload service did not return a URL" }, 502);
    return json({ url: result.url });
  } catch (err) {
    console.error("upload-image failed", err);
    return json({ error: "Upload failed" }, 500);
  }
});
