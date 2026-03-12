import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Legal & Fair Use — BGMancer",
  description:
    "Legal disclaimers, fair use declaration, DMCA contact, and third-party terms for BGMancer.",
};

export default function LegalPage() {
  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-10">
          <Link href="/" className="text-xs text-zinc-500 transition-colors hover:text-zinc-300">
            ← Back to BGMancer
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-white">Legal &amp; Fair Use</h1>
          <p className="mt-1 text-sm text-zinc-400">Last updated: March 2026</p>
        </div>

        <div className="space-y-10 text-sm leading-relaxed text-zinc-300">
          {/* Not affiliated */}
          <section>
            <h2 className="mb-3 text-base font-semibold text-white">Not affiliated</h2>
            <p>
              BGMancer is an independent personal project. It is not affiliated with, endorsed by,
              or connected to Google LLC, YouTube, Valve Corporation, Steam, or any video game
              developer, publisher, or rights holder whose games appear in the app.
            </p>
            <p className="mt-2">
              All game titles, franchise names, and soundtrack names are the property of their
              respective owners and are used here solely for identification purposes.
            </p>
          </section>

          {/* Unofficial notice */}
          <section>
            <h2 className="mb-3 text-base font-semibold text-white">Unofficial notice</h2>
            <p>
              This material is unofficial and is not endorsed by any video game developer or
              publisher. For more information, refer to the respective Fan Content Policies of the
              games indexed.
            </p>
          </section>

          {/* Content & hosting */}
          <section>
            <h2 className="mb-3 text-base font-semibold text-white">Content</h2>
            <p>
              BGMancer does not host, store, download, or reproduce any audio or video content. All
              media is streamed directly from YouTube through the official YouTube embedded player,
              in accordance with YouTube&apos;s Terms of Service. If a video is removed from
              YouTube, it automatically becomes unavailable here.
            </p>
          </section>

          {/* Non-commercial */}
          <section>
            <h2 className="mb-3 text-base font-semibold text-white">Non-commercial use</h2>
            <p>
              BGMancer is a non-commercial project. It does not sell, license, or monetize any
              music. No audio files are hosted, downloaded, or redistributed. All media is streamed
              directly from YouTube through the official YouTube embedded player.
            </p>
          </section>

          {/* Fair Use */}
          <section>
            <h2 className="mb-3 text-base font-semibold text-white">Fair use</h2>
            <p>
              BGMancer is a transformative, non-commercial curation tool. This use may qualify as{" "}
              <strong className="text-white">Fair Use</strong> under{" "}
              <strong className="text-white">17 U.S.C. § 107</strong> on the following grounds:
            </p>
            <ol className="mt-3 list-decimal space-y-2 pl-5 marker:text-zinc-500">
              <li>
                <strong className="text-white">Purpose and character</strong> — transformative
                curation for personal, non-commercial listening; no commercial gain.
              </li>
              <li>
                <strong className="text-white">Nature of the work</strong> — the underlying works
                are artistic, but the use is organizational, not reproductive.
              </li>
              <li>
                <strong className="text-white">Amount used</strong> — no audio files are copied or
                hosted. BGMancer indexes video IDs and surfaces them through YouTube&apos;s own
                embedded player.
              </li>
              <li>
                <strong className="text-white">Market effect</strong> — BGMancer drives traffic to
                YouTube and to rights holders&apos; official content; it does not substitute for
                purchasing soundtracks.
              </li>
            </ol>
            <p className="mt-3 text-zinc-400">
              This is not legal advice. If you are a rights holder with concerns, please see the
              contact section below.
            </p>
          </section>

          {/* Steam */}
          <section>
            <h2 className="mb-3 text-base font-semibold text-white">Steam</h2>
            <p>
              This application uses the Steam Web API to fetch a user&apos;s public game library. No
              Steam login or OAuth is required — only a server-side API key is used. BGMancer does
              not access any private Steam data. Game cover images are loaded directly from
              Steam&apos;s public CDN and are not stored by BGMancer.
            </p>
            <p className="mt-2">
              By using the Steam import feature, you agree to the{" "}
              <a
                href="https://store.steampowered.com/stats/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-400 hover:text-violet-300"
              >
                Steam Web API Terms of Use
              </a>
              .
            </p>
          </section>

          {/* YouTube */}
          <section>
            <h2 className="mb-3 text-base font-semibold text-white">YouTube</h2>
            <p>By using BGMancer you also agree to:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 marker:text-zinc-500">
              <li>
                <a
                  href="https://www.youtube.com/t/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-violet-400 hover:text-violet-300"
                >
                  YouTube Terms of Service
                </a>
              </li>
              <li>
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-violet-400 hover:text-violet-300"
                >
                  Google Privacy Policy
                </a>
              </li>
              <li>
                <a
                  href="https://developers.google.com/youtube/terms/api-services-terms-of-service"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-violet-400 hover:text-violet-300"
                >
                  YouTube API Services Terms of Service
                </a>
              </li>
            </ul>
          </section>

          {/* Google OAuth */}
          <section>
            <h2 className="mb-3 text-base font-semibold text-white">Google OAuth / user data</h2>
            <p>
              If you sign in with Google, BGMancer requests permission to manage your YouTube
              playlists. This access is used solely to create and update the &ldquo;BGMancer
              Journey&rdquo; playlist on your account. BGMancer does not sell, share, or store your
              Google account data beyond what is needed to authenticate your session. OAuth tokens
              are stored in memory only and are not persisted to the database.
            </p>
          </section>

          {/* DMCA */}
          <section>
            <h2 className="mb-3 text-base font-semibold text-white">Copyright / DMCA contact</h2>
            <p>
              If you are a copyright holder and believe your material is being used in a way that
              constitutes copyright infringement, please contact:
            </p>
            <p className="mt-2 font-medium text-white">
              <a href="mailto:legal@bgmancer.com" className="text-violet-400 hover:text-violet-300">
                legal@bgmancer.com
              </a>
            </p>
            <p className="mt-3">Please include:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 marker:text-zinc-500">
              <li>Your name and contact information</li>
              <li>Identification of the copyrighted work you believe is being infringed</li>
              <li>Identification of the specific content on BGMancer that you believe infringes</li>
              <li>A statement that you have a good-faith belief that the use is not authorized</li>
            </ul>
            <p className="mt-3">
              We will acknowledge your message within 7 days and promptly remove or disable access
              to any disputed content.
            </p>
          </section>

          {/* No warranty */}
          <section>
            <h2 className="mb-3 text-base font-semibold text-white">No warranty</h2>
            <p>
              This software is provided &ldquo;as is&rdquo;, without warranty of any kind. Use at
              your own risk.
            </p>
          </section>

          {/* Source code */}
          <section>
            <h2 className="mb-3 text-base font-semibold text-white">Source code (AGPL-3.0)</h2>
            <p>
              BGMancer is free software licensed under the{" "}
              <a
                href="https://github.com/talzerr/bgmancer/blob/main/LICENSE"
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-400 hover:text-violet-300"
              >
                GNU Affero General Public License v3
              </a>
              . If you host a modified version of BGMancer on a public server, the AGPL requires you
              to make your modified source code available to your users. The BGMancer name and logo
              are trademarks of Tal Koviazin; the license covers the code only.
            </p>
            <p className="mt-2">
              <a
                href="https://github.com/talzerr/bgmancer"
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-400 hover:text-violet-300"
              >
                View source on GitHub →
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
