declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    FILES: R2Bucket;
    ADMIN_SESSION_SECRET: string;
    ADMIN_PASSWORD_PEPPER: string;
    PANEL_BRIDGE_TOKEN: string;
  }
}
