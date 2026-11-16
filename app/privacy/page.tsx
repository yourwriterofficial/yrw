import type { Metadata } from 'next';
import LegalPage from '@/app/components/LegalPage';

export const metadata: Metadata = {
  title: { absolute: 'Privacy Policy | developa.me' },
  description: 'What personal information developa.me collects, why, who sees it, and your choices.',
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="16 November 2026"
      intro="This policy explains what personal information Developa (developa.me) collects, why we collect it, who it is shared with, and what choices you have. It follows the principles of the Nigeria Data Protection Act."
    >
      <section>
        <h2>1. Who is responsible</h2>
        <p>Developa decides how data about its own users (people with an account) is used. For a shopper who buys from a site built on Developa, the site&apos;s owner also receives the details needed to fill the order and is responsible for how they use them. Contact us at <a href="mailto:support@developa.me">support@developa.me</a>.</p>
      </section>

      <section>
        <h2>2. What we collect</h2>
        <ul>
          <li><strong>Account details:</strong> your name, email address, and sign-in method. If you sign in with Google, Subskription, NairaGuide or ProsePen we receive your name, email and whether your email is verified. We never see your password for those services.</li>
          <li><strong>Site and order details:</strong> products, orders, delivery details a shopper gives, messages, bookings, reviews and the content you publish.</li>
          <li><strong>Payment information:</strong> payments are handled by Paystack. We receive the status, amount and reference of a payment, not your full card number.</li>
          <li><strong>Technical data:</strong> device and browser type, pages visited and basic logs, used to run, secure and improve the service.</li>
          <li><strong>Optional alerts:</strong> if you turn on phone notifications, we store the address your browser gives us so we can send them.</li>
        </ul>
      </section>

      <section>
        <h2>3. How we use it</h2>
        <ul>
          <li>To create and run your account and site, process orders, and send receipts and order updates.</li>
          <li>To send service messages such as sign-in links, security notices and notices from the Developa team. Marketing email is only sent if you agree, and every one has an unsubscribe link.</li>
          <li>To prevent fraud and abuse, handle reports, and keep the service safe.</li>
          <li>To meet our legal duties, such as tax and record-keeping.</li>
        </ul>
      </section>

      <section>
        <h2>4. Who we share it with</h2>
        <p>We do not sell personal data. We share it only with services that help us run Developa, and only what they need:</p>
        <ul>
          <li><strong>Supabase</strong> (database and sign-in) and <strong>Vercel</strong> (hosting).</li>
          <li><strong>Cloudflare</strong> (network, security and incoming support email).</li>
          <li><strong>Paystack</strong> (online payments).</li>
          <li><strong>Resend</strong> (sending email).</li>
          <li>The <strong>owner of a site</strong> you order from or message, who needs your name, contact and delivery details to serve you.</li>
          <li>Authorities, where the law requires us to.</li>
        </ul>
        <p>Some of these providers store data outside Nigeria. We choose providers with appropriate safeguards.</p>
      </section>

      <section>
        <h2>5. Cookies and similar storage</h2>
        <p>We use cookies and browser storage that are needed to keep you signed in, remember your preferences, and protect against abuse. We do not use advertising cookies. Platform ads shown on free sites are not personalised from your browsing.</p>
      </section>

      <section>
        <h2>6. How long we keep it</h2>
        <p>We keep your data while your account is active. If you close your account we delete or anonymise personal data, except records we must keep for the law, accounting or an open dispute (for example payment and order records).</p>
      </section>

      <section>
        <h2>7. Your rights</h2>
        <p>You can ask to see the personal data we hold about you, correct it, delete it, object to certain uses, or take a copy. Email <a href="mailto:support@developa.me">support@developa.me</a> from the address on your account and we will respond promptly. You may also complain to the Nigeria Data Protection Commission.</p>
      </section>

      <section>
        <h2>8. Security</h2>
        <p>We protect data with access controls, encrypted connections, and limits on who can see what. No system is perfectly secure, so please use a strong sign-in method and tell us at once if you think your account was accessed by someone else.</p>
      </section>

      <section>
        <h2>9. Children</h2>
        <p>Developa is not meant for people under 18 without a parent or guardian. If you think a child gave us personal data, tell us and we will delete it.</p>
      </section>

      <section>
        <h2>10. Changes</h2>
        <p>We may update this policy. The date at the top shows the latest version, and we will tell account holders about important changes. See also our <a href="/terms">Terms of Service</a>.</p>
      </section>
    </LegalPage>
  );
}
