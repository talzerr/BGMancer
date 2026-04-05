import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Legal & Disclaimers — BGMancer",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-foreground text-lg font-medium">{title}</h2>
      {children}
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground text-sm leading-relaxed">{children}</p>;
}

function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary hover:text-[var(--primary-hover)]"
    >
      {children}
    </a>
  );
}

export default function LegalPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <Link
        href="/"
        className="hover:text-muted-foreground mb-8 inline-block text-xs text-[var(--text-disabled)]"
      >
        &larr; Back to BGMancer
      </Link>

      <h1 className="font-display text-foreground mb-8 text-2xl font-medium -tracking-[0.03em]">
        Legal & Disclaimers
      </h1>

      <div className="space-y-8">
        <Section title="Not affiliated">
          <P>
            BGMancer is an independent personal project. It is not affiliated with, endorsed by, or
            connected to Google LLC, YouTube, Valve Corporation, Steam, or any video game developer,
            publisher, or rights holder whose games appear in the app.
          </P>
          <P>
            All game titles, franchise names, and soundtrack names are the property of their
            respective owners and are used here solely for identification purposes.
          </P>
        </Section>

        <Section title="Content">
          <P>
            BGMancer does not host, store, download, or reproduce any audio or video content. All
            media is streamed directly from YouTube through the official YouTube embedded player, in
            accordance with YouTube&apos;s terms of service.
          </P>
        </Section>

        <Section title="Steam">
          <P>
            This application uses the Steam Web API to fetch public game library data. No Steam
            login is required from the user. Game cover images are loaded directly from Steam&apos;s
            public CDN and are not stored by BGMancer.
          </P>
          <P>
            By using the Steam import feature, you agree to the{" "}
            <ExtLink href="https://store.steampowered.com/stats/">
              Steam Web API Terms of Use
            </ExtLink>
            .
          </P>
        </Section>

        <Section title="YouTube">
          <P>This application uses the YouTube Data API v3. By using BGMancer you also agree to:</P>
          <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
            <li>
              <ExtLink href="https://www.youtube.com/t/terms">YouTube Terms of Service</ExtLink>
            </li>
            <li>
              <ExtLink href="https://policies.google.com/privacy">Google Privacy Policy</ExtLink>
            </li>
            <li>
              <ExtLink href="https://developers.google.com/youtube/terms/api-services-terms-of-service">
                YouTube API Services Terms of Service
              </ExtLink>
            </li>
          </ul>
        </Section>

        <Section title="Google OAuth & user data">
          <P>
            If you sign in with Google, BGMancer requests your email address for authentication. No
            profile name or picture is requested or stored.
          </P>
          <P>
            If you use the &quot;Sync to YouTube&quot; feature, BGMancer requests additional
            permission to manage your YouTube playlists. This access is used solely to create and
            update the &quot;BGMancer Journey&quot; playlist on your account. YouTube permissions
            are only requested when you click Sync — not at initial sign-in.
          </P>
          <P>
            BGMancer does not sell, share, or store your Google account data beyond what is needed
            to authenticate your session. OAuth tokens are stored in encrypted session cookies and
            are not persisted to the database.
          </P>
        </Section>

        <Section title="Fair use">
          <P>
            BGMancer is a transformative, non-commercial curation tool. It does not reproduce,
            download, store, or distribute any copyrighted audio. It organizes and presents links to
            publicly available content already uploaded to YouTube.
          </P>
          <P>
            This use may qualify as Fair Use under 17 U.S.C. &sect; 107 on the following grounds:
          </P>
          <ol className="text-muted-foreground list-inside list-decimal space-y-1 text-sm">
            <li>
              <strong className="text-foreground">Purpose and character</strong> — transformative
              curation for personal, non-commercial listening.
            </li>
            <li>
              <strong className="text-foreground">Nature of the work</strong> — the underlying works
              are artistic, but the use is organizational, not reproductive.
            </li>
            <li>
              <strong className="text-foreground">Amount used</strong> — no audio files are copied
              or hosted.
            </li>
            <li>
              <strong className="text-foreground">Market effect</strong> — BGMancer drives traffic
              to YouTube and to the rights holders&apos; official content.
            </li>
          </ol>
          <P>
            This is not legal advice. If you are a rights holder with concerns, please see the
            contact section below.
          </P>
        </Section>

        <Section title="Non-commercial use">
          <P>
            BGMancer is a non-commercial project. It does not sell, license, or monetize any music.
            No audio files are hosted, downloaded, or redistributed. All media is streamed directly
            from YouTube through the official YouTube embedded player.
          </P>
        </Section>

        <Section title="No warranty">
          <P>
            This software is provided &quot;as is&quot;, without warranty of any kind. Use at your
            own risk.
          </P>
        </Section>

        <Section title="Copyright / DMCA contact">
          <P>
            If you are a copyright holder and believe your material is being used in a way that
            constitutes copyright infringement, please contact{" "}
            <ExtLink href="mailto:legal@bgmancer.com">legal@bgmancer.com</ExtLink>.
          </P>
          <P>
            Include your name and contact information, identification of the copyrighted work, the
            specific content on BGMancer you believe infringes your rights, and a statement of
            good-faith belief. We will acknowledge your message within 7 days.
          </P>
        </Section>
      </div>

      <div className="border-border mt-12 border-t pt-4">
        <P>
          Full source available on{" "}
          <ExtLink href="https://github.com/talzerr/bgmancer">GitHub</ExtLink>. See also{" "}
          <ExtLink href="https://github.com/talzerr/bgmancer/blob/main/LEGAL.md">LEGAL.md</ExtLink>{" "}
          for the raw version of this document.
        </P>
      </div>
    </div>
  );
}
