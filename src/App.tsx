import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import Database from "@tauri-apps/plugin-sql";

const VAULT_PATH = "D:\\AEGIS_VAULT_TEST";

// FIX: Générateur d'ID manuel pour éviter les erreurs crypto sur Windows
function generateSimpleId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function App() {
  const [status, setStatus] = useState<string>("INITIALIZING...");
  const [db, setDb] = useState<Database | null>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [activeContent, setActiveContent] = useState<string>("");
  const [activeFile, setActiveFile] = useState<string>("");
  const [syncStatus, setSyncStatus] = useState<string>("");

  useEffect(() => {
    const init = async () => {
      try {
        const sysMsg = await invoke<string>("check_system_status");
        const database = await Database.load("sqlite:aegis.db");
        setDb(database);
        setStatus(`${sysMsg} | MEMORY: CONNECTED`);
      } catch (err) {
        console.error(err);
        setStatus("SYSTEM FAILURE: " + err);
      }
    };
    init();
  }, []);

  const handleScan = async () => {
    if (!db) return alert("Database not ready");
    setSyncStatus("SCANNING...");

    try {
      // A. Lecture Disque
      const fileList = await invoke<string[]>("scan_vault", { path: VAULT_PATH });
      setFiles(fileList);

      // B. Écriture Mémoire
      setSyncStatus(`INDEXING...`);
      let newCount = 0;

      for (const file of fileList) {
        // Utilisation du générateur simple ID
        const simpleId = generateSimpleId();

        const result = await db.execute(
          "INSERT OR IGNORE INTO notes (id, path, last_synced) VALUES ($1, $2, $3)",
          [simpleId, file, Date.now()]
        );
        if (result.rowsAffected > 0) newCount++;
      }

      setSyncStatus(`SYNC COMPLETE (+${newCount})`);

    } catch (error) {
      console.error("Erreur sync:", error);
      // AFFICHE L'ERREUR RÉELLE À L'ÉCRAN
      alert("ERREUR CRITIQUE SQL : " + error);
      setSyncStatus("SYNC ERROR");
    }
  };

  const handleReadFile = async (fileName: string) => {
    try {
      const fullPath = `${VAULT_PATH}\\${fileName}`;
      const content = await invoke<string>("read_note", { path: fullPath });
      setActiveContent(content);
      setActiveFile(fileName);
    } catch (error) {
      alert("Erreur lecture: " + error);
    }
  };

  return (
    <div className="h-screen w-screen bg-black text-white p-6 flex flex-col overflow-hidden font-sans">

      {/* HEADER */}
      <div className="mb-6 border-b border-gray-800 pb-4 flex justify-between items-end">
        <div>
          <h1 className="text-xl font-bold tracking-widest text-gray-100">AEGIS V3 COCKPIT</h1>
          <div className="flex items-center gap-2 mt-1">
            <div className={`w-2 h-2 rounded-full ${status.includes("FAILURE") ? 'bg-red-500' : 'bg-green-500'}`}></div>
            <p className="text-gray-400 text-xs font-mono tracking-wider">{status}</p>
          </div>
        </div>
        <div className="text-right">
          <p className={`text-xs font-mono font-bold ${syncStatus.includes("ERROR") ? "text-red-500" : "text-blue-400"}`}>{syncStatus}</p>
        </div>
      </div>

      {/* WORKSPACE */}
      <div className="flex flex-1 gap-4 min-h-0">

        {/* SIDEBAR */}
        <div className="w-64 bg-gray-900 rounded-lg border border-gray-800 flex flex-col p-3">
          <button
            onClick={handleScan}
            className="w-full bg-blue-700 hover:bg-blue-600 text-white py-3 px-3 rounded text-xs font-bold uppercase tracking-wider mb-4 transition-colors shadow-lg shadow-blue-900/20"
          >
            SYNC VAULT & DB
          </button>

          <div className="flex-1 overflow-y-auto">
            <h3 className="text-xs font-bold text-gray-500 uppercase mb-2 px-1">Repository ({files.length})</h3>
            <ul className="space-y-1">
              {files.map((file) => (
                <li
                  key={file}
                  onClick={() => handleReadFile(file)}
                  className={`cursor-pointer px-3 py-2 rounded text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-all flex items-center gap-2 ${activeFile === file ? "bg-gray-800 border-l-2 border-green-500 text-white" : ""}`}
                >
                  <span className="opacity-50">doc</span> {file}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* EDITOR */}
        <div className="flex-1 bg-gray-950 rounded-lg border border-gray-800 p-0 overflow-hidden flex flex-col">
          {activeFile ? (
            <>
              <div className="bg-gray-900 px-6 py-3 border-b border-gray-800 flex justify-between items-center">
                <span className="font-mono text-sm text-gray-200">{activeFile}</span>
                <span className="text-xs text-gray-600 uppercase tracking-widest">Read-Only Mode</span>
              </div>
              <div className="p-6 overflow-auto flex-1">
                <pre className="whitespace-pre-wrap font-mono text-sm text-gray-300 leading-relaxed max-w-3xl">
                  {activeContent}
                </pre>
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-700 select-none">
              <div className="text-4xl mb-4 opacity-20">◈</div>
              <p className="text-xs tracking-widest uppercase">Awaiting Target Selection</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default App;
