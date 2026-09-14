import react from "@vitejs/plugin-react";
import fs from "node:fs";
import { defineConfig, loadEnv } from "vite";

// VITE_BLOCKS_DEV_HOST: set this in .env to your project's real domain
// (from Project/Gets -> applications[].domain) to test OIDC login locally
// -- Blocks SSO sets a Secure, domain-scoped cookie that browsers refuse
// on plain http://localhost. Run `npm run cert` once that's set, then
// trust the generated .cert/dev-cert.pem. See README.md.
export default defineConfig(({ mode }) => {
  // Vite does not inject .env values into process.env for its own config
  // file -- loadEnv reads .env/.env.local explicitly (third arg "" loads
  // every key, not just VITE_-prefixed ones, though ours already are).
  const env = loadEnv(mode, process.cwd(), "");
  const domain = env.VITE_BLOCKS_DEV_HOST || undefined;
  const port = Number(env.VITE_BLOCKS_DEV_PORT || 5173);
  const https = fs.existsSync(".cert/dev-key.pem") && fs.existsSync(".cert/dev-cert.pem")
    ? { key: fs.readFileSync(".cert/dev-key.pem"), cert: fs.readFileSync(".cert/dev-cert.pem") }
    : undefined;

  return {
    plugins: [react()],
    server: {
      // Vite blocks unrecognized Host headers by default (DNS-rebinding
      // protection) -- without this, a custom domain 404s with "Blocked
      // request. This host is not allowed" even once hosts + cert are set.
      allowedHosts: domain ? [domain, "localhost", "127.0.0.1"] : undefined,
      // Bind on all interfaces (or localhost loopback) so Node doesn't try
      // to listen on the public IP the dev domain happens to resolve to.
      // The browser still reaches us via the hosts-file entry mapping
      // 127.0.0.1 -> <domain>; the cert's SAN covers the domain name.
      host: "0.0.0.0",
      https,
      port,
      // Keep the port fixed: it's part of the registered OIDC redirect_uri.
      strictPort: true
    }
  };
});
