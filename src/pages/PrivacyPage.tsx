import { useEffect } from 'react';
import { Link } from 'react-router-dom';

const UPDATED = '2026-10-03';

const sectionStyle: React.CSSProperties = { marginBottom: 32 };
const h2Style: React.CSSProperties = {
  fontFamily: "'Space Grotesk', sans-serif",
  fontSize: 18,
  fontWeight: 700,
  color: 'var(--text-strong)',
  margin: '0 0 10px',
};
const pStyle: React.CSSProperties = { fontSize: 14, lineHeight: 1.75, color: 'var(--text-muted)', margin: '0 0 10px' };
const liStyle: React.CSSProperties = { fontSize: 14, lineHeight: 1.7, color: 'var(--text-muted)' };
const codeStyle: React.CSSProperties = {
  fontFamily: "'SFMono-Regular', Menlo, Consolas, monospace",
  fontSize: 12.5,
  color: 'var(--text)',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  padding: '1px 5px',
};
const linkStyle: React.CSSProperties = { color: 'var(--accent)' };

function Ext({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" style={linkStyle}>{children}</a>;
}

export default function PrivacyPage() {
  useEffect(() => {
    document.title = 'Privacy — Bottlenecker';
    const desc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (desc) desc.content = 'What Bottlenecker collects: anonymous usage counts and Google AdSense cookies. Your diagrams stay in your browser.';
  }, []);

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: 'var(--bg-base)', color: 'var(--text)' }}>
      <main style={{ maxWidth: 720, margin: '0 auto', padding: 'clamp(32px, 6vw, 64px) clamp(16px, 5vw, 32px) 64px' }}>
        <h1 style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: 'clamp(26px, 4vw, 34px)',
          fontWeight: 700,
          color: 'var(--text-strong)',
          margin: '0 0 8px',
        }}>
          Privacy
        </h1>
        <p style={{ ...pStyle, color: 'var(--text-dim)', marginBottom: 32 }}>Last updated {UPDATED}</p>

        <section style={sectionStyle}>
          <h2 style={h2Style}>The short version</h2>
          <p style={pStyle}>
            Bottlenecker has no accounts. The simulation runs in your browser and your diagrams never
            leave it unless you share a link or export a file yourself. The site counts a few anonymous
            usage events, and it shows Google AdSense ads, which use cookies.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>Your diagrams stay in your browser</h2>
          <ul className="bn-list" style={{ paddingLeft: 20, margin: 0 }}>
            <li style={liStyle}>
              The canvas you are working on and the diagrams you save are kept in your browser’s local
              storage (<code style={codeStyle}>bottlenecker-diagrams</code>), and your colour theme
              in <code style={codeStyle}>bottlenecker-theme</code>. They are never sent to us. Clearing
              your site data deletes them.
            </li>
            <li style={liStyle}>
              A share link carries the diagram inside the link itself, after the <code style={codeStyle}>#</code>.
              Browsers do not send that part to the server, so we never receive it; anyone you give the
              link to can open the diagram.
            </li>
            <li style={liStyle}>JSON, PNG and JPG exports are created in your browser and downloaded straight to your device.</li>
          </ul>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>Anonymous usage counts</h2>
          <p style={pStyle}>
            To show how much the tool is used (the “simulations run worldwide” and “visits” counters) the
            site sends an event name to a database hosted by{' '}
            <Ext href="https://supabase.com/privacy">Supabase</Ext>. The events are:
          </p>
          <ul className="bn-list" style={{ paddingLeft: 20, margin: '0 0 10px' }}>
            <li style={liStyle}><code style={codeStyle}>page_view</code> — a page of the site was opened</li>
            <li style={liStyle}><code style={codeStyle}>analyze_click</code> — the Analyze button was pressed</li>
            <li style={liStyle}><code style={codeStyle}>template_used</code> — a template or lesson was opened on the canvas</li>
            <li style={liStyle}>
              <code style={codeStyle}>export_json</code>, <code style={codeStyle}>export_png</code>,{' '}
              <code style={codeStyle}>export_jpg</code> — a diagram was exported
            </li>
          </ul>
          <p style={pStyle}>
            Only the event name is sent: no diagram content, no account, no cookie and no identifier of
            ours. As with any web request, Supabase’s servers see your IP address when they receive it.
            If your browser sends Global Privacy Control or Do Not Track, no events are sent at all.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>Advertising (Google AdSense)</h2>
          <p style={pStyle}>
            The site is free and is supported by ads from Google AdSense. Google and its partners use
            cookies and similar technologies to serve ads, measure them and, where allowed, personalise
            them based on your visits to this and other websites. Google’s{' '}
            <Ext href="https://policies.google.com/technologies/partner-sites">explanation of how it uses information from sites that use its services</Ext>{' '}
            covers what is collected.
          </p>
          <p style={pStyle}>
            Third-party vendors, including Google, use cookies to serve ads based on your prior visits to
            this website or other websites. Google’s use of advertising cookies enables it and its partners
            to serve ads to you based on your visits to this site and/or other sites on the Internet.
          </p>
          <p style={pStyle}>
            You can opt out of personalised advertising in Google’s{' '}
            <Ext href="https://adssettings.google.com/">Ads Settings</Ext>, and opt out of other
            third-party vendors’ use of cookies for personalised advertising at{' '}
            <Ext href="https://www.aboutads.info/choices/">aboutads.info</Ext>. You can also block
            third-party cookies or ads in your browser. Bottlenecker works fully with ads blocked.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>Fonts</h2>
          <p style={pStyle}>
            The Inter and Space Grotesk fonts are loaded from Google Fonts, so your browser requests them
            from Google’s servers. See the <Ext href="https://developers.google.com/fonts/faq/privacy">Google Fonts privacy FAQ</Ext>.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>Questions</h2>
          <p style={pStyle}>
            Bottlenecker is open source, so you can check all of the above in the{' '}
            <Ext href="https://github.com/Jabito/arkynate-bottlenecker">source code</Ext>. Ask questions
            or report a problem in <Ext href="https://github.com/Jabito/arkynate-bottlenecker/issues">GitHub Issues</Ext>;
            report security issues privately as described in the repository’s security policy.
          </p>
          <p style={pStyle}>
            <Link to="/" style={linkStyle}>← Back to Bottlenecker</Link>
          </p>
        </section>
      </main>
    </div>
  );
}
