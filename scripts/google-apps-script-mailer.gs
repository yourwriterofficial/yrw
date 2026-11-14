/**
 * Google Apps Script: Developa.me & YourResearchWriter Mailer Fallback
 *
 * Sends emails for developa.me / YourResearchWriter (order updates, ad requests, reminders, vault deliveries)
 * from your own Google account for free. Gmail allows ~100 emails/day (1,500 with Google Workspace).
 *
 * Set up (2 minutes):
 * 1. Go to https://script.google.com and create a New project.
 * 2. Replace the code with this file and click Save.
 * 3. Project Settings -> Script properties -> add:
 *      MAIL_SECRET = <a long random secret>
 *    (or change SHARED_SECRET below)
 * 4. Deploy > New deployment > type "Web app". Execute as: Me. Who has access: Anyone.
 * 5. Copy the Web app URL and add to .env.local and your hosting platform (Vercel/Cloudflare):
 *      GOOGLE_APPS_SCRIPT_MAIL_URL="https://script.google.com/macros/s/.../exec"
 *      MAIL_SECRET="the same long random secret"
 */

var SHARED_SECRET = "CHANGE-ME-to-a-long-random-string";
var DEFAULT_SENDER_NAME = "developa.me";

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function getConfiguredSecret() {
  try {
    var props = PropertiesService.getScriptProperties();
    var val = props.getProperty("MAIL_SECRET") || props.getProperty("SHARED_SECRET");
    if (val) return val.trim();
  } catch (e) {}
  if (SHARED_SECRET && SHARED_SECRET.indexOf("CHANGE-ME") !== 0) {
    return SHARED_SECRET.trim();
  }
  return "";
}

function doGet() {
  var secret = getConfiguredSecret();
  return out({
    ok: true,
    service: "Developa.me & YourResearchWriter Apps Script Mailer",
    secretConfigured: Boolean(secret),
    remainingDailyQuota: MailApp.getRemainingDailyQuota(),
    timestamp: new Date().toISOString()
  });
}

function doPost(e) {
  try {
    var expectedSecret = getConfiguredSecret();
    if (!expectedSecret) {
      return out({ ok: false, success: false, error: "Set MAIL_SECRET in Script Properties first" });
    }

    var data = {};
    try {
      data = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    } catch (parseErr) {
      return out({ ok: false, success: false, error: "Invalid JSON body" });
    }

    if (data.secret !== expectedSecret) {
      return out({ ok: false, success: false, error: "Invalid secret" });
    }

    var to = Array.isArray(data.to) ? data.to.join(",") : String(data.to || "").trim();
    if (!to || !to.includes("@")) {
      return out({ ok: false, success: false, error: "Bad recipient" });
    }

    var subject = String(data.subject || "").trim();
    var html = data.html || data.htmlBody || "";
    var text = data.text || (html ? html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "");

    if (!subject || (!html && !text)) {
      return out({ ok: false, success: false, error: "Missing subject or body" });
    }

    if (MailApp.getRemainingDailyQuota() < 1) {
      return out({ ok: false, success: false, error: "Daily quota exhausted", remaining: 0 });
    }

    var mailOpts = {
      to: to,
      subject: subject.slice(0, 250),
      body: text || subject,
      name: String(data.fromName || data.name || DEFAULT_SENDER_NAME),
    };

    if (html) mailOpts.htmlBody = String(html);
    if (data.replyTo) mailOpts.replyTo = String(data.replyTo).trim();
    if (data.cc) mailOpts.cc = Array.isArray(data.cc) ? data.cc.join(",") : String(data.cc);
    if (data.bcc) mailOpts.bcc = Array.isArray(data.bcc) ? data.bcc.join(",") : String(data.bcc);

    if (Array.isArray(data.attachments) && data.attachments.length > 0) {
      var blobs = [];
      for (var i = 0; i < data.attachments.length; i++) {
        var att = data.attachments[i];
        if (!att || !att.content) continue;
        var rawB64 = String(att.content);
        var commaIdx = rawB64.indexOf(",");
        if (rawB64.indexOf("data:") === 0 && commaIdx !== -1) {
          rawB64 = rawB64.slice(commaIdx + 1);
        }
        var mime = att.mimeType || att.contentType || "application/octet-stream";
        var name = att.filename || att.name || ("attachment-" + (i + 1));
        blobs.push(Utilities.newBlob(Utilities.base64Decode(rawB64), mime, name));
      }
      if (blobs.length > 0) mailOpts.attachments = blobs;
    }

    MailApp.sendEmail(mailOpts);
    var remaining = MailApp.getRemainingDailyQuota();
    return out({ ok: true, success: true, remaining: remaining });
  } catch (err) {
    return out({ ok: false, success: false, error: String(err && err.message ? err.message : err) });
  }
}
