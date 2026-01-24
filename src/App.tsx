import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import Database from "@tauri-apps/plugin-sql";

const VAULT_PATH = "D:\\AEGIS_VAULT_TEST";

function App() {
  const [status, setStatus] = useState<string>("");
  const [files, setFiles] = useState<string[]>([]);
  const [activeContent, setActiveContent] = useState<string>("");
  const [activeFile, setActiveFile] = useState<string>("");

  useEffect(() => {
    // 1. Check System
    invoke<string>("check_system_status")
      .then((msg) => setStatus(msg))
      .catch((err) => console.error(err));

    // 2. Test DB Connection
    const initDb = async () => {
      try {
        const db = await Database.load("sqlite:aegis.db");
        await db.execute("INSERT OR IGNORE INTO notes (id, path, last_synced) VALUES ($1, $2, $3)", ["TEST_ID", "system_check", Date.now()]);
        console.log("DB Connection: SUCCESS");
      } catch (e) {
        console.error("DB Error:", e);
      }
    };
    initDb();
  }, []);

  const handleScan = async () => {
    try {
      const fileList = await invoke<string[]>("scan_vault", { path: VAULT_PATH });
      setFiles(fileList);
    } catch (error) {
      console.error("Erreur scan:", error);
      alert("Erreur de scan : " + error);
    }
  };

  const handleReadFile = async (fileName: string) => {
    console.log("Tentative de lecture :", fileName);
    try {
      const fullPath = `${VAULT_PATH}\\${fileName}`;
      const content = await invoke<string>("read_note", { path: fullPath });
      setActiveContent(content);
      setActiveFile(fileName);
    } catch (error) {
      console.error("Erreur lecture:", error);
      alert("Impossible de lire le fichier : " + error);
    }
  };

  return (
    <div className="h-screen w-screen bg-black text-white p-6 flex flex-col overflow-hidden font-sans">

      {/* HEADER */}
      <div className="mb-6 border-b border-gray-800 pb-4">
        <h1 className="text-xl font-bold tracking-widest text-gray-100">AEGIS V3 COCKPIT</h1>
        <div className="flex items-center gap-2 mt-1">
          <div className={`w-2 h-2 rounded-full ${status ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <p className="text-green-500 text-xs font-mono tracking-wider">{status || "OFFLINE"}</p>
        </div>
      </div>

      {/* WORKSPACE */}
      <div className="flex flex-1 gap-4 min-h-0">

        {/* SIDEBAR (EXPLORATEUR) */}
        <div className="w-64 bg-gray-900 rounded-lg border border-gray-800 flex flex-col p-3">
          <button
            onClick={handleScan}
            className="w-full bg-blue-700 hover:bg-blue-600 text-white py-2 px-3 rounded text-xs font-bold uppercase tracking-wider mb-4 transition-colors"
          >
            Scan Vault
          </button>

          <div className="flex-1 overflow-y-auto">
            <h3 className="text-xs font-bold text-gray-500 uppercase mb-2 px-1">Fichiers ({files.length})</h3>
            <ul className="space-y-1">
              {files.map((file) => (
                <li
                  key={file}
                  onClick={() => handleReadFile(file)}
                  className={`cursor-pointer px-3 py-2 rounded text-sm text-gray-300 hover:bg-gray-800 transition-colors flex items-center gap-2 ${activeFile === file ? 'bg-gray-800 text-blue-400 font-bold border-l-2 border-blue-500' : ''}`}
                >
                  <span className="text-xs">📄</span>
                  <span className="truncate">{file}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div className="flex-1 bg-gray-900 rounded-lg border border-gray-800 p-4 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-800">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              {activeFile ? `EDITOR : ${activeFile}` : "NO ACTIVE FILE"}
            </h2>
            {activeFile && <span className="text-xs text-gray-600 font-mono">READ-ONLY</span>}
          </div>

          <div className="flex-1 overflow-auto bg-black/30 rounded p-4 font-mono text-sm text-gray-300 shadow-inner">
            {activeContent ? (
              <pre className="whitespace-pre-wrap">{activeContent}</pre>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-600">
                <p>Awaiting Input...</p>
                <p className="text-xs mt-2">Select a file from the vault to inspect content.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;
