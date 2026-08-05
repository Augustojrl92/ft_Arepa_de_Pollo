import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | AEDLPH",
  description: "Privacy policy for the AEDLPH platform.",
};

export default function PrivacyPage() {
  return (
    <main className="aedlph-container flex-1 py-10">
      <article className="mx-auto max-w-4xl space-y-8 rounded-2xl border border-border bg-card p-8 shadow-sm">
        <header className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">Privacy Policy</p>
          <h1 className="text-4xl font-black text-text">How AEDLPH handles personal data</h1>
          <p className="max-w-3xl text-base leading-7 text-text-secondary">
            This policy explains what data the platform collects, why it is processed, how it is stored, and which controls users have over their information.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold text-text">Data we collect</h2>
          <p className="leading-7 text-text-secondary">
            AEDLPH may store the information needed to authenticate users, sync 42 campus data, render rankings, and keep the application usable across sessions. This can include OAuth identifiers, profile metadata from 42, coalition data, user preferences, avatar uploads, favorites or social lists, and operational logs required to keep the service running.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold text-text">How we use it</h2>
          <ul className="space-y-2 text-text-secondary">
            <li>- Authenticate the user and maintain the local session.</li>
            <li>- Synchronize campus, coalition, and ranking data from the 42 API.</li>
            <li>- Render dashboards, charts, achievements, and social features.</li>
            <li>- Remember UI preferences such as theme and pagination size.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold text-text">Storage and retention</h2>
          <p className="leading-7 text-text-secondary">
            The application stores data in the project database and may keep limited browser storage for the session. Historical snapshots are retained so rankings and trends can be shown over time. When data is no longer needed, it should be removed according to the project rules and user requests.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold text-text">Sharing and third parties</h2>
          <p className="leading-7 text-text-secondary">
            AEDLPH interacts with the 42 API and the infrastructure required to host the application. It does not sell personal data. Public campus data that comes from 42 may be displayed inside the platform as part of the project functionality.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold text-text">User controls</h2>
          <p className="leading-7 text-text-secondary">
            Users should be able to review, update, and remove the personal information the platform stores whenever those flows are implemented by the project. If an OAuth connection is revoked or expires, the application should degrade gracefully and avoid leaving the user in an inconsistent state.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold text-text">Contact</h2>
          <p className="leading-7 text-text-secondary">
            For project-related privacy questions, contact the AEDLPH team through the channels used for the course delivery or via the maintainers of the repository.
          </p>
        </section>

        <p className="text-sm text-text-secondary">Last updated: August 2026.</p>
      </article>
    </main>
  );
}
