import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // VPS / self-hosted build: VITE_API_URL set (or VITE_BACKEND=laravel) means
  // the app must talk ONLY to the Laravel/MySQL API — no Supabase connection.
  // Alias the Supabase client to a Laravel-backed shim so any direct
  // `@/integrations/supabase/client` import is routed to the VPS API instead.
  const isLaravelBuild = env.VITE_BACKEND === "laravel" || (!!env.VITE_API_URL && env.VITE_BACKEND !== "supabase");

  const alias: Record<string, string> = {
    "@": path.resolve(__dirname, "./src"),
  };
  if (isLaravelBuild) {
    alias["@/integrations/supabase/client"] = path.resolve(
      __dirname,
      "./src/integrations/supabase/laravelClient.ts",
    );
  }

  return {
  define: {
    __APP_BUILD_ID__: JSON.stringify(
      new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14),
    ),
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias,
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          pdf: ["jspdf", "jspdf-autotable"],
          xlsx: ["xlsx"],
          charts: ["recharts"],
          vendor: ["react", "react-dom", "react-router-dom", "@tanstack/react-query"],
        },
      },
    },
  },
  };
});
