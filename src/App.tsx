import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface AppInfo {
  name: string;
  version: string;
}

export function App() {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);

  useEffect(() => {
    invoke<AppInfo>("get_app_info").then(setAppInfo).catch(console.error);
  }, []);

  return (
    <div className="flex h-screen items-center justify-center bg-neutral-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-neutral-900">
          {appInfo?.name ?? "Loading..."}
        </h1>
        {appInfo && (
          <p className="mt-2 text-sm text-neutral-500">v{appInfo.version}</p>
        )}
        <p className="mt-6 text-neutral-400">
          Local-first note-taking. Coming soon.
        </p>
      </div>
    </div>
  );
}
