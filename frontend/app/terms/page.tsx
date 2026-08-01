import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | AEDLPH",
  description: "Terms of service for the AEDLPH platform.",
};

export default function TermsPage() {
  return (
    <main className="aedlph-container flex-1 py-10">
      <article className="mx-auto max-w-4xl space-y-8 rounded-2xl border border-border bg-card p-8 shadow-sm">
        <header className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">Terms of Service</p>
          <h1 className="text-4xl font-black text-text">Rules for using AEDLPH</h1>
          <p className="max-w-3xl text-base leading-7 text-text-secondary">
            These terms describe the expected use of the platform, the responsibilities of users, and the limitations that apply while the service is running as a course project.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold text-text">1. Service purpose</h2>
          <p className="leading-7 text-text-secondary">
            AEDLPH is a learning project built for the 42 curriculum. It provides coalition rankings, user dashboards, synced campus data, achievements, social features, and PWA support. The platform may change as the project evolves.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold text-text">2. User accounts</h2>
          <p className="leading-7 text-text-secondary">
            Users are responsible for the security of their account access and for the accuracy of the information they connect to the platform. If the 42 authorization is revoked or expires, some features may become unavailable until the account is connected again.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold text-text">3. Acceptable use</h2>
          <ul className="space-y-2 text-text-secondary">
            <li>- Do not attempt to abuse the 42 API, the backend, or the PWA cache.</li>
            <li>- Do not submit malicious content, spam, or abusive messages.</li>
            <li>- Do not interfere with rankings, snapshots, or other shared data.</li>
            <li>- Respect the community rules that apply to the 42 environment and to the project itself.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold text-text">4. Availability and limitations</h2>
          <p className="leading-7 text-text-secondary">
            AEDLPH depends on external services, local synchronization jobs, and the development environment used to host it. The team may keep the service unavailable while fixing bugs, updating data, or changing the implementation. Offline mode is limited to the cached shell and the pages that have been designed to work without network access.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold text-text">5. Intellectual property</h2>
          <p className="leading-7 text-text-secondary">
            The code, branding, and custom content created for this project remain part of the repository and course deliverable. External libraries, APIs, and documentation remain subject to their own licenses and terms.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold text-text">6. Changes to the service</h2>
          <p className="leading-7 text-text-secondary">
            The application may introduce, modify, or remove features to satisfy course requirements or fix issues. Continued use of the platform after a change means the user accepts the updated behavior of the project.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold text-text">7. Contact</h2>
          <p className="leading-7 text-text-secondary">
            Questions about these terms should be directed to the AEDLPH team through the course repository or the agreed communication channel for the project.
          </p>
        </section>

        <p className="text-sm text-text-secondary">Last updated: August 2026.</p>
      </article>
    </main>
  );
}
