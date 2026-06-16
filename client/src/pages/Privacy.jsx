export default function Privacy() {
  return (
    <div className="min-h-screen bg-slate-950 px-4 py-12">
      <div className="max-w-2xl mx-auto space-y-8">

        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-0.5">FOURTH & DATA</p>
          <h1 className="text-3xl font-black text-white tracking-tight">Privacy Policy</h1>
          <p className="text-slate-500 text-sm mt-1">Last updated: June 2026</p>
        </div>

        <Section title="What we collect and why">
          <Item label="Username">
            Used to identify your account. Shown to you on the platform. Must be unique.
          </Item>
          <Item label="Email address">
            Required to create an account. Used to ensure each account is unique (no two accounts share the same email).
            We do <strong className="text-slate-300">not</strong> send marketing emails, newsletters, or any unsolicited messages.
            Your email is never shown publicly and is not shared with third parties.
          </Item>
          <Item label="Password">
            Used to secure your account. Your password is <strong className="text-slate-300">never stored as plain text</strong> —
            it is immediately converted to a one-way bcrypt hash before being saved.
            This means even we cannot see your actual password.
          </Item>
          <Item label="Login timestamps">
            Each time you log in, we record the date and time. This is used to show activity statistics in the admin panel
            (e.g., visits today). No location or device information is collected.
          </Item>
          <Item label="Saved content">
            Any players, comparisons, Smart Search results, or notes you choose to save are stored under your account.
            This data is only accessible to you.
          </Item>
          <Item label="Feedback">
            Any messages you submit through the Feedback page are stored and visible only to the platform admin.
          </Item>
        </Section>

        <Section title="What we do not do">
          <ul className="space-y-2 text-slate-400 text-sm leading-relaxed">
            <li>We do <strong className="text-slate-300">not</strong> sell, share, or transfer your data to any third party.</li>
            <li>We do <strong className="text-slate-300">not</strong> use your data for advertising or profiling.</li>
            <li>We do <strong className="text-slate-300">not</strong> send emails (no verification emails, no newsletters, no notifications).</li>
            <li>We do <strong className="text-slate-300">not</strong> collect payment information — the platform is free.</li>
          </ul>
        </Section>

        <Section title="Third-party services">
          <p className="text-slate-400 text-sm leading-relaxed">
            The platform uses the <strong className="text-slate-300">Anthropic Claude API</strong> to power Smart Search and AI Career Insights.
            When you use these features, your question or the player's stats are sent to Anthropic's servers to generate a response.
            No personally identifiable information (username, email, password) is included in those requests.
            Anthropic's own privacy policy applies to data processed through their API.
          </p>
        </Section>

        <Section title="Data retention and deletion">
          <p className="text-slate-400 text-sm leading-relaxed">
            Your account and all associated data (saved items, notes, feedback) are retained for as long as your account exists.
            To delete your account, send a request through the <strong className="text-slate-300">Feedback</strong> page.
            Deletion is permanent and cannot be undone.
          </p>
        </Section>

        <Section title="Contact">
          <p className="text-slate-400 text-sm leading-relaxed">
            Questions or concerns? Use the Feedback page inside the platform. This platform is independently operated and not affiliated with the NFL or any of its teams.
          </p>
        </Section>

      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
      <h2 className="text-white font-bold text-base">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Item({ label, children }) {
  return (
    <div>
      <p className="text-amber-400/80 text-xs font-semibold uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-slate-400 text-sm leading-relaxed">{children}</p>
    </div>
  )
}
