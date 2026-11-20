import LoginForm from "./LoginForm";

export const metadata = { title: "Sign in", robots: { index: false } };

export default async function Login({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  return (
    <main className="login">
      <div style={{ width: "min(420px,100%)" }}>
        <h1 className="name" style={{ fontSize: "clamp(48px,9vw,72px)", marginBottom: 24 }}>Linnea Moritz</h1>
        <LoginForm error={e} />
        <p className="msg" style={{ marginTop: 24 }}><a href="/">Back to the portfolio</a></p>
      </div>
    </main>
  );
}
