#!/usr/bin/env node

const targets = [
  { name: "local", base: "http://195.35.20.203:8000" },
  { name: "production", base: "https://api.voicedots.io" },
];

for (const target of targets) {
  const url = `${target.base}/v3/auth/login`;
  const form = new URLSearchParams({ email: "connectivity-check@example.invalid", password: "not-a-real-password" });
  const started = Date.now();

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form,
      signal: AbortSignal.timeout(10000),
    });
    const elapsed = Date.now() - started;
    console.log(`${target.name}: ${response.status} ${response.statusText} (${elapsed}ms)`);
    if (response.status === 401 || response.status === 422) {
      console.log("  API is reachable; credentials were intentionally not tested.");
    }
  } catch (error) {
    console.log(`${target.name}: unreachable`);
    console.log(`  ${error instanceof Error ? error.message : String(error)}`);
  }
}
