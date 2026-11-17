import { Section, Table, Mail } from './prose';

// Carried over from the previous site's policy (23 Sept 2026). Changed for the
// new site: hosting and database now in the EU, cookieless visit statistics,
// only a session-storage marker for the opening animation. Review before launch (README).
export const UPDATED_EN = '17 November 2026';

export default function PrivacyEn() {
  return (
    <>
      <p className="mt-6 text-[16px] leading-relaxed text-ink/85 md:text-[18px]">
        What we learn about you when you use this website or talk to us, where it is kept, and what you can ask us to do
        with it.
      </p>

      <Section n={1} title="Who we are">
        <p>SIA Project Nidos is the controller of the personal data described in this policy.</p>
        <p>
          SIA Project Nidos, Reg. No. 40203751563, VAT LV40203751563, Paula Lejiņa iela 4 - 42, Riga, LV-1029, Latvia.
          Email: <Mail />.
        </p>
        <p>
          We set up Google shops, build AI solutions for specific processes, digitalise businesses in line with EU
          regulation, and support and maintain the systems we deliver. This policy covers our website, projectnidos.eu,
          and our dealings with the people we talk to about that work. When we handle personal data inside a client&apos;s
          own systems during a project, we do so on the client&apos;s behalf under a separate data processing agreement.
        </p>
      </Section>

      <Section n={2} title="What we collect">
        <p>
          <strong className="font-medium text-ink">When you use the contact form:</strong> your name, email address,
          company (if you give it), the service you are interested in and your message. They are stored with the date and
          the language of the page, and read by the Project Nidos team in our admin panel.
        </p>
        <p>
          <strong className="font-medium text-ink">When you email us:</strong> your email address, your message and
          anything you attach, along with the details email headers normally carry.
        </p>
        <p>
          <strong className="font-medium text-ink">When we work together, or talk about it:</strong> your name, work
          email, phone number, company and role, and our notes from calls and meetings. If we contact you first, we use
          business contact details that you or your company have made public and say where we found them in our first
          message.
        </p>
        <p>
          <strong className="font-medium text-ink">When you visit the website:</strong> like any web server, ours sees
          your IP address, browser type, the page you asked for and the time; our hosting provider keeps these request
          logs for a short period (section 6). We also count visits ourselves: which pages are viewed, which website or
          campaign link brought you here, whether you used a phone, tablet or computer, and whether you clicked a service
          or sent the form. To tell visits apart we use a code computed from your IP address and browser, a secret key
          and the date. The code changes every day, cannot be turned back into your IP address, and the IP address itself
          is not stored with it, so it cannot follow you from one day to the next.
        </p>
        <p>
          <strong className="font-medium text-ink">In your browser:</strong> only one marker in the browser&apos;s session
          storage (sessionStorage), so the opening animation shows once per visit. It holds no personal data, is never
          sent anywhere, and the browser deletes it when you close the tab. The website sets no cookies, so there is no
          cookie notice.
        </p>
        <p>
          <strong className="font-medium text-ink">What we do not do:</strong> we use no third-party analytics, tracking
          pixels, advertising networks, social media plugins, fingerprinting or third-party scripts. Fonts, images and
          video are served from our own server, so loading a page tells no one else that you visited.
        </p>
      </Section>

      <Section n={3} title="Why we use it, and on what basis">
        <p>Each use rests on one of the grounds in Article 6(1) GDPR:</p>
        <Table
          head={['Purpose', 'Legal basis']}
          rows={[
            ['Answering your enquiry and preparing a proposal', 'Steps you asked for before a contract — Art. 6(1)(b)'],
            [
              'Delivering and invoicing our services',
              'Performance of a contract — Art. 6(1)(b); accounting records under Latvian law — Art. 6(1)(c)',
            ],
            [
              'Following up with business contacts, including contacting you first',
              'Our legitimate interest in finding and serving clients — Art. 6(1)(f)',
            ],
            [
              'Counting visits to see which pages and services are useful',
              'Our legitimate interest in improving the website — Art. 6(1)(f)',
            ],
            ['Keeping the website secure and running', 'Our legitimate interest in a working, secure service — Art. 6(1)(f)'],
          ]}
        />
        <p>
          Where we rely on legitimate interests you can object at any time, and for business outreach we will simply
          stop. We do not sell personal data, use it for advertising, or make decisions about you by automated means.
        </p>
      </Section>

      <Section n={4} title="Who else sees it">
        <p>These providers process personal data for us, each under data processing terms as Article 28 GDPR requires:</p>
        <Table
          head={['Provider', 'What they do for us', 'Where']}
          rows={[
            ['Railway Corporation', 'Hosts the website and keeps the request logs', 'EU (Netherlands)'],
            ['Supabase Inc.', 'Database for enquiries and visit statistics; admin sign-in', 'Switzerland (Zurich)'],
            ['GoDaddy', `Email for support@projectnidos.eu`, 'USA'],
          ]}
        />
        <p>
          Inside Project Nidos, enquiries are seen only by the staff who need them. Beyond that we share personal data
          only when the law requires it, or, with your agreement, with a partner you ask us to bring into a project.
        </p>
      </Section>

      <Section n={5} title="Transfers outside the EU">
        <p>
          The website is hosted in the EU and its database in Switzerland, which the European Commission recognises as
          giving adequate protection (Article 45 GDPR), so that transfer needs no further safeguards. Email is handled by GoDaddy in the United States; that
          transfer relies on the European Commission&apos;s Standard Contractual Clauses and, where the provider is
          certified, the EU–US Data Privacy Framework. Railway and Supabase are US companies; their data processing terms
          include the same safeguards. You can ask us for a copy at <Mail />.
        </p>
      </Section>

      <Section n={6} title="How long we keep it">
        <ul>
          <li>Enquiries that do not lead to a project: deleted 12 months after our last contact.</li>
          <li>Business contacts we reached out to: deleted 12 months after our last contact, or straight away if you object.</li>
          <li>
            Client and project records: kept while we work together and for 5 years after, to meet Latvian accounting
            requirements and deal with any claims.
          </li>
          <li>Email: kept on the same terms as the enquiry or project it belongs to.</li>
          <li>Visit statistics: deleted after 13 months.</li>
          <li>Request logs: kept by our hosting provider for no more than 30 days, then deleted automatically.</li>
          <li>
            Security log (IP address, browser name and the address requested, when a request was blocked or looked like an
            attack, such as too many sign-in attempts or probing for pages that do not exist): deleted after 30 days.
          </li>
        </ul>
      </Section>

      <Section n={7} title="Your rights">
        <p>Under Articles 15 to 22 GDPR you can ask us to:</p>
        <ul>
          <li>show you the personal data we hold about you, and give you a copy;</li>
          <li>correct anything that is wrong;</li>
          <li>delete it;</li>
          <li>restrict how we use it while a question about it is settled;</li>
          <li>hand it over in a machine-readable format, to you or to another company;</li>
          <li>stop using it where we rely on legitimate interests, and for direct marketing, always.</li>
        </ul>
        <p>
          Write to <Mail />. We reply within one month; for complex requests we may take up to two months more and will
          tell you why (Article 12(3) GDPR). We may ask you to confirm who you are first.
        </p>
      </Section>

      <Section n={8} title="Complaints">
        <p>
          If you think we have handled your data wrongly, tell us first and we will try to put it right. You can also
          complain to the Latvian supervisory authority, or to the authority where you live or work: Datu valsts
          inspekcija (Data State Inspectorate), Elijas iela 17, Riga, LV-1050, Latvia,{' '}
          <a href="https://www.dvi.gov.lv" rel="noopener noreferrer">www.dvi.gov.lv</a>.
        </p>
      </Section>

      <Section n={9} title="Children">
        <p>Our website and services are for businesses. We do not knowingly collect personal data from children.</p>
      </Section>

      <Section n={10} title="Changes and contact">
        <p>
          When we change this policy we update the date at the top of the page. If a change materially affects data we
          already hold, we tell the people concerned directly. Questions about privacy: <Mail />, or by post to SIA
          Project Nidos, Paula Lejiņa iela 4 - 42, Riga, LV-1029, Latvia.
        </p>
      </Section>
    </>
  );
}
