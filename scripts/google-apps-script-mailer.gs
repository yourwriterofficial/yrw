/**
 * Google Apps Script: Developa site mailer
 *
 * Sends the emails for developa sites (order updates, ad requests, reminders) from your own Google
 * account for free. Gmail allows about 100 emails a day (1,500 with Google Workspace). When that runs
 * out the app automatically falls back to its normal email service, so nothing is lost.
 *
 * Set up (2 minutes):
 * 1. Go to https://script.google.com and create a New project.
 * 2. Replace the code with this file and click Save.
 * 3. Change SHARED_SECRET below to a long random string.
 * 4. Deploy > New deployment > type "Web app". Execute as: Me. Who has access: Anyone.
 * 5. Copy the Web app URL and add to .env.local and your host:
 *      GOOGLE_APPS_SCRIPT_MAIL_URL="https://script.google.com/macros/s/.../exec"
 *      MAIL_SECRET="the same long random string"
 */

var SHARED_SECRET = "CHANGE-ME-to-a-long-random-string";
var SENDER_NAME = "developa.me";

function doPost(e) {
  try {
    if (SHARED_SECRET.indexOf("CHANGE-ME") === 0) return out({ ok: false, error: "Set SHARED_SECRET first" });
    var data = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (data.secret !== SHARED_SECRET) return out({ ok: false, error: "Invalid secret" });
    if (!data.to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.to)) return out({ ok: false, error: "Bad recipient" });
    if (!data.subject || !data.html) return out({ ok: false, error: "Missing subject or body" });

    if (MailApp.getRemainingDailyQuota() < 1) return out({ ok: false, error: "Daily quota used" });

    MailApp.sendEmail({
      to: data.to,
      subject: String(data.subject).slice(0, 200),
      htmlBody: String(data.html),
      name: SENDER_NAME,
      noReply: true
    });
    return out({ ok: true, remaining: MailApp.getRemainingDailyQuota() });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  }
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
