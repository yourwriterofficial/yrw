/**
 * Developa.me & YourResearchWriter — Cloudflare Email Worker
 * Handles:
 * 1. Cloudflare Email Routing Inbound (`email` handler) -> forwards to /api/email/inbound
 * 2. Outbound relay (`fetch` handler) -> sends via SEND_EMAIL binding, Brevo, or Apps Script fallback
 */

function toBase64Utf8(str) {
  const bytes = new TextEncoder().encode(str || "");
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

function wrapBase64(b64) {
  return String(b64 || "").replace(/(.{76})/g, "$1\r\n").trim();
}

function cleanHeader(val) {
  return String(val || "").replace(/[\r\n]+/g, " ").trim();
}

function parseAddress(input, fallbackName, fallbackEmail) {
  const cleaned = cleanHeader(input);
  const m = cleaned.match(/^\s*(?:"?([^"<]+)"?\s*)?<([^>\s]+)>\s*$/);
  if (m) {
    return {
      name: (m[1] || fallbackName).trim(),
      email: m[2].trim(),
    };
  }
  if (cleaned.includes("@")) {
    return { name: fallbackName, email: cleaned };
  }
  return { name: fallbackName, email: fallbackEmail };
}

function encodeMimeWord(text) {
  const clean = cleanHeader(text);
  if (!clean) return "";
  return /^[\x20-\x7E]*$/.test(clean) ? clean : `=?UTF-8?B?${toBase64Utf8(clean)}?=`;
}

function buildRawMime({ from, to, replyTo, subject, html, text, attachments }) {
  const boundaryMixed = `----=_Part_Mixed_${crypto.randomUUID().replace(/-/g, "")}`;
  const boundaryAlt = `----=_Part_Alt_${crypto.randomUUID().replace(/-/g, "")}`;
  const domain = from.email.includes("@") ? from.email.split("@")[1] : "yourresearchwriter.com.ng";
  const msgId = `<${crypto.randomUUID()}@${domain.trim()}>`;
  const plainText = text || String(html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || subject;

  const headers = [
    `Date: ${new Date().toUTCString()}`,
    `From: ${from.name ? `"${from.name.replace(/"/g, "")}" ` : ""}<${from.email}>`,
    `To: <${cleanHeader(to)}>`,
    ...(replyTo ? [`Reply-To: <${cleanHeader(replyTo)}>`] : []),
    `Subject: ${encodeMimeWord(subject)}`,
    `Message-ID: ${msgId}`,
    `MIME-Version: 1.0`,
  ];

  const altPart = [
    `--${boundaryAlt}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    wrapBase64(toBase64Utf8(plainText)),
    `--${boundaryAlt}`,
    `Content-Type: text/html; charset="UTF-8"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    wrapBase64(toBase64Utf8(html || plainText)),
    `--${boundaryAlt}--`,
  ].join("\r\n");

  const validAttachments = Array.isArray(attachments)
    ? attachments.filter((a) => a && a.content)
    : [];

  if (validAttachments.length === 0) {
    headers.push(`Content-Type: multipart/alternative; boundary="${boundaryAlt}"`);
    return { msgId, raw: `${headers.join("\r\n")}\r\n\r\n${altPart}\r\n` };
  }

  const mixedParts = [
    `--${boundaryMixed}`,
    `Content-Type: multipart/alternative; boundary="${boundaryAlt}"`,
    ``,
    altPart,
  ];

  for (let i = 0; i < validAttachments.length; i++) {
    const att = validAttachments[i];
    const filename = cleanHeader(att.filename || att.name || `attachment-${i + 1}`).replace(/"/g, "");
    const mimeType = cleanHeader(att.mimeType || att.contentType || "application/octet-stream");
    let b64 = String(att.content);
    const commaIdx = b64.indexOf(",");
    if (b64.startsWith("data:") && commaIdx !== -1) b64 = b64.slice(commaIdx + 1);
    mixedParts.push(
      `--${boundaryMixed}`,
      `Content-Type: ${mimeType}; name="${filename}"`,
      `Content-Disposition: attachment; filename="${filename}"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      wrapBase64(b64),
    );
  }
  mixedParts.push(`--${boundaryMixed}--`);
  headers.push(`Content-Type: multipart/mixed; boundary="${boundaryMixed}"`);
  return { msgId, raw: `${headers.join("\r\n")}\r\n\r\n${mixedParts.join("\r\n")}\r\n` };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function timingSafeMatch(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function extractSenderName(headerVal) {
  const m = cleanHeader(headerVal).match(/^\s*"?([^"<]+)"?\s*</);
  return m ? m[1].trim() : "";
}

export default {
  async email(message, env) {
    const rawBuffer = await new Response(message.raw).arrayBuffer();
    const rawBody = new TextDecoder("utf-8", { fatal: false }).decode(rawBuffer);

    const subject = message.headers.get("subject") || "(No Subject)";
    const fromHeader = message.headers.get("from") || "";
    const messageId = message.headers.get("message-id") || undefined;
    const inReplyTo = message.headers.get("in-reply-to") || undefined;
    const ingestUrl = env.INBOUND_WEBHOOK_URL || "https://yourresearchwriter.com.ng/api/email/inbound";
    const secret = env.EMAIL_INGEST_SECRET || env.MAIL_SECRET || "";

    const res = await fetch(ingestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { "x-email-secret": secret } : {}),
      },
      body: JSON.stringify({
        to: message.to,
        from: message.from,
        fromName: extractSenderName(fromHeader) || undefined,
        subject,
        rawBody,
        messageId,
        inReplyTo,
      }),
    });

    if (env.FORWARD_TO_EMAIL) {
      await message.forward(env.FORWARD_TO_EMAIL).catch((err) => {
        console.warn("Optional forward failed:", err?.message || err);
      });
    }

    if (!res.ok) {
      const errTxt = await res.text().catch(() => "");
      console.error("Inbound webhook error:", res.status, errTxt);
      message.setReject(`Webhook failed (${res.status})`);
    }
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET") {
      return json({
        ok: true,
        service: "Developa.me & YourResearchWriter Cloudflare Email Worker",
        hasSendEmailBinding: Boolean(env.SEND_EMAIL),
        hasBrevoFallback: Boolean(env.BREVO_API_KEY),
        hasAppsScriptFallback: Boolean(env.GOOGLE_APPS_SCRIPT_MAIL_URL || env.GOOGLE_APPS_SCRIPT_URL),
        inboundTarget: env.INBOUND_WEBHOOK_URL || "https://yourresearchwriter.com.ng/api/email/inbound",
      });
    }

    if (request.method !== "POST") {
      return json({ ok: false, error: "Method not allowed" }, 405);
    }

    const expectedSecret = (env.EMAIL_INGEST_SECRET || env.MAIL_SECRET || "").trim();
    if (!expectedSecret) {
      return json({ ok: false, error: "EMAIL_INGEST_SECRET / MAIL_SECRET not configured on worker" }, 500);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ ok: false, error: "Invalid JSON body" }, 400);
    }

    const headerSecret = request.headers.get("x-email-secret") || "";
    const bearer = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const providedSecret = (headerSecret || bearer || payload.secret || "").trim();
    if (!timingSafeMatch(providedSecret, expectedSecret)) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }

    if (url.pathname === "/health") {
      return json({ ok: true });
    }

    const recipients = Array.isArray(payload.to)
      ? payload.to.map(cleanHeader).filter(Boolean)
      : String(payload.to || "")
          .split(",")
          .map(cleanHeader)
          .filter(Boolean);

    const subject = cleanHeader(payload.subject || "");
    const html = payload.html || "";
    const text = payload.text || "";

    if (!recipients.length || !subject || (!html && !text)) {
      return json({ ok: false, error: "Missing required fields: to, subject, html/text" }, 400);
    }

    const defaultFrom = env.DEFAULT_FROM_EMAIL || "noreply@yourresearchwriter.com.ng";
    const from = parseAddress(payload.from || "", payload.fromName || "YourResearchWriter", defaultFrom);

    const errors = [];

    if (env.SEND_EMAIL) {
      try {
        const { EmailMessage } = await import("cloudflare:email");
        let lastMsgId = "";
        for (const recipient of recipients) {
          const { msgId, raw } = buildRawMime({
            from,
            to: recipient,
            replyTo: payload.replyTo,
            subject,
            html,
            text,
            attachments: payload.attachments,
          });
          const msg = new EmailMessage(from.email, recipient, raw);
          await env.SEND_EMAIL.send(msg);
          lastMsgId = msgId;
        }
        return json({ ok: true, success: true, via: "cloudflare_email", id: lastMsgId });
      } catch (err) {
        errors.push(`SEND_EMAIL: ${err?.message || String(err)}`);
      }
    } else {
      errors.push("SEND_EMAIL binding not configured");
    }

    // Optional worker-level Brevo fallback
    if (env.BREVO_API_KEY) {
      try {
        const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "api-key": env.BREVO_API_KEY.trim(), "Content-Type": "application/json" },
          body: JSON.stringify({
            sender: from,
            to: recipients.map((email) => ({ email })),
            ...(payload.replyTo ? { replyTo: { email: cleanHeader(payload.replyTo) } } : {}),
            subject,
            htmlContent: html || `<pre>${text}</pre>`,
            ...(text ? { textContent: text } : {}),
          }),
        });
        if (brevoRes.ok) {
          const data = await brevoRes.json().catch(() => ({}));
          return json({ ok: true, success: true, via: "cloudflare_worker_brevo", id: data.messageId });
        }
        errors.push(`Worker Brevo ${brevoRes.status}`);
      } catch (err) {
        errors.push(`Worker Brevo: ${err?.message || String(err)}`);
      }
    }

    // Optional worker-level Apps Script fallback
    const appsScriptUrl = env.GOOGLE_APPS_SCRIPT_MAIL_URL || env.GOOGLE_APPS_SCRIPT_URL;
    if (appsScriptUrl) {
      try {
        const gasRes = await fetch(appsScriptUrl.trim(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          redirect: "follow",
          body: JSON.stringify({
            secret: env.MAIL_SECRET || expectedSecret,
            to: recipients[0],
            subject,
            html: html || `<pre>${text}</pre>`,
            text,
            fromName: from.name,
            replyTo: payload.replyTo,
            attachments: payload.attachments,
          }),
        });
        const gasJson = gasRes.ok ? await gasRes.json().catch(() => null) : null;
        if (gasJson?.ok || gasJson?.success) {
          return json({ ok: true, success: true, via: "cloudflare_worker_apps_script" });
        }
        errors.push(`Worker Apps Script ${gasRes.status}`);
      } catch (err) {
        errors.push(`Worker Apps Script: ${err?.message || String(err)}`);
      }
    }

    return json({ ok: false, success: false, error: errors.join(" | ") }, 502);
  },
};
