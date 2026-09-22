import { useState } from "react";
import { login } from "../api.js";
import Icon, { Brand } from "../components/Icon.jsx";

export default function Login({ onLoggedIn, onPreview }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function handleSubmit(e) {
    e.preventDefault(); setError(""); setBusy(true);
    try { const { token } = await login(username.trim(), password); onLoggedIn(token); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <main className="login-page">
    <section className="login-story">
      <Brand light />
      <div className="story-copy"><span className="eyebrow"><span className="status-dot"/> EQUITY RESEARCH, CONNECTED</span>
        <h1>Different perspectives.<br/><span>A clearer picture.</span></h1>
        <p>A dedicated team of research agents. One workspace to understand the companies that matter to you.</p>
      </div>
      <div className="story-visual" aria-hidden="true">
        <div className="orbit orbit-one"/><div className="orbit orbit-two"/>
        <div className="orbit-center"><span className="brand-symbol"><span/><span/><span/></span></div>
        <div className="orbit-node node-one"><Icon name="building"/><span>Company strategy</span><i/></div>
        <div className="orbit-node node-two"><Icon name="chart"/><span>Financial analysis</span><i/></div>
        <div className="orbit-node node-three"><Icon name="globe"/><span>Market intelligence</span><i/></div>
        <div className="visual-caption">INDEPENDENT THINKING. INTEGRATED INSIGHT.</div>
      </div>
      <div className="story-footer"><span>Built with Strands Agents</span><span>Powered by local intelligence <Icon name="spark" size={15}/></span></div>
    </section>
    <section className="login-form-area">
      <div className="login-top-note">YOUR NEXT PERSPECTIVE STARTS HERE</div>
      <div className="login-form-wrap"><span className="overline">THE RESEARCH WORKSPACE</span><h2>Welcome back.</h2><p className="lead">A little more clarity. A lot less noise.</p>
        <form onSubmit={handleSubmit}>
          <div className="field"><label htmlFor="username">Username</label><input id="username" placeholder="Enter your username" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" required disabled={busy}/></div>
          <div className="field"><label htmlFor="password">Password</label><div className="password-field"><input id="password" type={showPassword ? "text" : "password"} placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required disabled={busy}/><button type="button" className="icon-button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}><Icon name="eye"/></button></div></div>
          {error && <div className="error-banner" role="alert"><Icon name="info"/><span>{error}</span></div>}
          <button className="button primary login-submit" type="submit" disabled={busy}>{busy ? "Signing in…" : "Open your workspace"}<Icon name="arrow"/></button>
        </form>
        <div className="login-divider"><span/>or take a look around<span/></div>
        <button className="button secondary preview-button" onClick={onPreview} disabled={busy}>Explore sample workspace<Icon name="up" size={18}/></button>
        <div className="demo-note"><Icon name="info" size={18}/><p><strong>Workshop edition</strong><br/>Sign in with <code>admin</code> / <code>admin</code> when the backend is running. This demo does not use real authentication.</p></div>
      </div>
      <footer className="login-footer"><span>Finance Research Swarm</span><span>Research with perspective.</span></footer>
    </section>
  </main>;
}
