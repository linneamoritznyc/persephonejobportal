import LoginForm from "./LoginForm";

export const metadata = { title: "Sign in", robots: { index: false } };

export default async function Login({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  return (
    <main className="login">
      <div style={{ width: "min(420px,100%)" }}>
        <span className="brand">persephone</span>
        <h1>Job search without anxiety.</h1>
        <p className="sub">Sign in, Linnea. Your matches, letters and drafts are waiting.</p>
        <LoginForm error={e} />
        <p className="msg" style={{ marginTop: 24 }}><a href="/">Back to the portfolio</a></p>
      </div>
    </main>
  );
}
