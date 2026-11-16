import type { Metadata } from 'next';
import LegalPage from '@/app/components/LegalPage';

export const metadata: Metadata = {
  title: { absolute: 'Terms of Service | developa.me' },
  description: 'The rules for using developa.me to build and run an online store, portfolio, blog or community.',
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="16 November 2026"
      intro="These terms are the agreement between you and Developa (developa.me) when you create an account, build a site, or buy from a site built on Developa. Please read them. By using Developa you agree to them."
    >
      <section>
        <h2>1. What Developa is</h2>
        <p>Developa lets people create an online store, portfolio, blog or community without writing code, and publish it on a developa.me address or their own domain. Developa provides the tools. Each site belongs to its owner, who is responsible for what it sells and says.</p>
      </section>

      <section>
        <h2>2. Your account</h2>
        <ul>
          <li>You must give true details and keep your sign-in safe. You are responsible for what happens under your account.</li>
          <li>You must be at least 18, or have a parent or guardian who agrees on your behalf.</li>
          <li>One person or business may not use many accounts to avoid a limit or a ban.</li>
        </ul>
      </section>

      <section>
        <h2>3. Plans, fees and billing</h2>
        <ul>
          <li>The Starter plan is free, with the limits shown on the pricing page. Paid plans are charged per month for the period you pay for, and your site returns to Starter limits when a paid period ends without renewal.</li>
          <li>When a shopper pays online, a small platform fee is taken from that payment before the rest goes to the seller. The fee is shown in your dashboard before you accept online payments. Payment processing is by Paystack and is also subject to Paystack&apos;s terms and charges.</li>
          <li>Email sending packs and paid themes are one-off purchases and are described where you buy them.</li>
          <li>Prices are in Nigerian naira. We may change prices for future periods with notice in your dashboard or by email.</li>
        </ul>
      </section>

      <section>
        <h2>4. Rules for sellers</h2>
        <p>If you sell through a Developa site you must:</p>
        <ul>
          <li>Only sell things you are allowed to sell, and describe them honestly, with real prices and delivery times.</li>
          <li>Deliver what shoppers paid for, answer their messages, and handle refunds and returns fairly.</li>
          <li>Follow Nigerian law, including consumer protection and tax rules that apply to you.</li>
        </ul>
        <p><strong>You may not sell or promote:</strong> illegal goods, stolen or counterfeit goods, weapons, drugs, adult content, scams or pyramid schemes, hacked accounts or data, or anything that harms people. You may not use Developa to collect money without delivering what you promised.</p>
      </section>

      <section>
        <h2>5. Orders, payments and refunds between shoppers and sellers</h2>
        <p>When you buy from a site, your purchase is with the site&apos;s owner, not with Developa. The owner sets the delivery terms and the refund and returns policy shown on the site. If you have a problem, contact the seller first using the contact details on their site. If a seller does not respond or you believe you were cheated, report it to us using the report option on the site or by email, and we will look into it. Developa may suspend a site while we investigate, but we are not able to guarantee a refund of money paid to a seller.</p>
      </section>

      <section>
        <h2>6. Refunds of Developa fees</h2>
        <ul>
          <li>Paid plan fees are not refundable once the paid period has started, except where the law requires it or where we made an error. If something we provide did not work as described, tell us within 7 days at support@developa.me and we will put it right or refund the affected period.</li>
          <li>Email packs and themes already delivered are not refundable, except where we made an error.</li>
        </ul>
      </section>

      <section>
        <h2>7. Content and what you may post</h2>
        <p>You keep ownership of the content you add to your site. You give Developa permission to host, display and back it up so the service can work. You promise you have the right to use everything you upload, and that it does not break anyone&apos;s rights or the law. Do not post anything that is unlawful, hateful, threatening, or that invades someone&apos;s privacy.</p>
      </section>

      <section>
        <h2>8. Reports, limits and removal</h2>
        <p>Anyone can report a site, product or post. We may limit, hide, suspend or remove a site or account that breaks these terms, is reported credibly, or puts shoppers at risk. We will tell the owner why where we can, and owners may reply at support@developa.me. We may act immediately in cases of fraud or serious abuse.</p>
      </section>

      <section>
        <h2>9. Availability and changes</h2>
        <p>We work to keep Developa running but cannot promise it will always be available or free from errors. We may change or stop features, and we will give notice where a change significantly affects you. Keep your own copy of anything important, such as product lists and customer details.</p>
      </section>

      <section>
        <h2>10. Our responsibility</h2>
        <p>To the extent the law allows, Developa is not responsible for losses that come from a seller&apos;s actions, from your content, or from things outside our control such as network or payment-provider outages. Where we are responsible, our total liability to you is limited to the fees you paid to Developa in the 3 months before the problem. Nothing here limits any right you have that cannot be limited by law.</p>
      </section>

      <section>
        <h2>11. Ending your account</h2>
        <p>You can stop using Developa at any time and ask us to delete your account at support@developa.me. We may close accounts that break these terms. After closing, some records (such as payment records and order history) are kept for as long as the law or a dispute requires.</p>
      </section>

      <section>
        <h2>12. Governing law and contact</h2>
        <p>These terms are governed by the laws of the Federal Republic of Nigeria. For questions, write to <a href="mailto:support@developa.me">support@developa.me</a>. How we handle personal data is explained in our <a href="/privacy">Privacy Policy</a>.</p>
      </section>
    </LegalPage>
  );
}
