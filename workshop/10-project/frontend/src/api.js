async function request(path, options = {}) {
  let response;
  try { response = await fetch(path, { ...options, signal: options.signal || AbortSignal.timeout(15000) }); }
  catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error("The research service is unavailable. Check that the backend is running and try again.");
  }
  if (!response.ok) {
    if (response.status === 401) throw new Error("Those credentials didn't match. For this workshop, use admin / admin.");
    if (response.status >= 500) throw new Error("The research service is unavailable. Check that the backend is running on port 8000 and try again.");
    throw new Error("The research service could not complete the request. Please try again.");
  }
  return response.json();
}
export function login(username, password) {
  return request("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
}
export function analyze(ticker, signal) {
  return request("/api/analyze", { method: "POST", signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticker }) });
}
export function getReport(jobId, signal) { return request(`/api/report/${encodeURIComponent(jobId)}`, { signal }); }
export function openProgressSocket(jobId, onEvent) {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const ws = new WebSocket(`${proto}//${window.location.host}/ws/progress/${encodeURIComponent(jobId)}`);
  ws.onmessage = msg => { try { onEvent(JSON.parse(msg.data)); } catch { /* Ignore malformed progress; report polling remains authoritative. */ } };
  return ws;
}
