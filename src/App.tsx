import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

function App() {
  const [status, setStatus] = useState("");
  const [files, setFiles] = useState<String[]>([]);

  useEffect(() => {
    invoke("check_system_status").then((msg) => {
      setStatus(msg as string);
    });
  }, []);

  const handleScanVault = async () => {
    try {
      const result = await invoke<String[]>("scan_vault", { path: "D:\\AEGIS_VAULT_TEST" });
      setFiles(result);
    } catch (error) {
      console.error("Failed to scan vault:", error);
    }
  };

  return (
    <div className="h-screen w-screen bg-black flex flex-col items-center justify-center text-white font-mono">
      <div className="text-xl">AEGIS V3 - SYSTEM INITIALIZED</div>
      <div className="text-green-600 font-bold mt-2">{status}</div>

      <button
        onClick={handleScanVault}
        className="mt-8 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white font-bold transition-colors"
      >
        SCAN VAULT
      </button>

      <div className="mt-4 w-full max-w-md">
        {files.length > 0 && (
          <div className="bg-gray-900 p-4 rounded border border-gray-800">
            <h3 className="text-gray-400 mb-2 text-sm uppercase tracking-wider">Detected Files:</h3>
            <ul className="space-y-1">
              {files.map((file, idx) => (
                <li key={idx} className="text-blue-400">
                  📄 {file}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
