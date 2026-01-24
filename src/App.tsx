import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import Database from "@tauri-apps/plugin-sql";

const VAULT_PATH = "D:\\AEGIS_VAULT_TEST";

interface Note {
  id: string;
  path: string;
  last_synced: number;
}

function generateSimpleId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function App() {
  const [status, setStatus] = useState<string>("INITIALIZING...");
  const [db, setDb] = useState<Database | null>(null);
  const [library, setLibrary] = useState<Note[]>([]);
  const [activeContent, setActiveContent] = useState<string>("");
  const [activeFile, setActiveFile] = useState<string>("");
  const [syncStatus, setSyncStatus] = useState<string>("");
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const sysMsg = await invoke<string>("check_system_status");
        const database = await Database.load("sqlite:aegis.db");
        setDb(database);
        setStatus(`${sysMsg} | MEMORY: CONNECTED`);
        await loadLibrary(database);
      } catch (err) {
        console.error(err);
        setStatus("SYSTEM FAILURE: " + err);
      }
    };
    init();
  }, []);

  const loadLibrary = async (database: Database) => {
    try {
      const notes = await database.select<Note[]>("SELECT * FROM notes ORDER BY last_synced DESC");
      setLibrary(notes);
    } catch (err) {
      console.error("Erreur chargement bibliothèque:", err);
    }
  };

  const handleScan = async () => {
    if (!db) return alert("Database not ready");
    setSyncStatus("SCANNING...");

    try {
      const fileList = await invoke<string[]>("scan_vault", { path: VAULT_PATH });
      setSyncStatus(`INDEXING...`);

      let newCount = 0;
      for (const file of fileList) {
        const simpleId = generateSimpleId();
        const result = await db.execute(
          "INSERT OR IGNORE INTO notes (id, path, last_synced) VALUES ($1, $2, $3)",
          [simpleId, file, Date.now()]
        );
        if (result.rowsAffected > 0) newCount++;
      }

      setSyncStatus(`SYNC COMPLETE (+${newCount})`);
      await loadLibrary(db);

    } catch (error) {
      console.error("Erreur sync:", error);
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
      setIsDirty(false);
    } catch (error) {
      alert("Erreur lecture: " + error);
    }
  };

  const handleCreate = async () => {
    const name = prompt("Nom de la nouvelle note (ex: Meeting_CEO) :");
    if (!name) return;

    const fileName = name.endsWith(".md") ? name : `${name}.md`;
    const fullPath = `${VAULT_PATH}\\${fileName}`;

    try {
      const template = `# ${name}\n\nCreated: ${new Date().toLocaleString()}\n\n`;
      await invoke("create_note", { path: fullPath, content: template });
      await handleScan();
      handleReadFile(fileName);
    } catch (err) {
      alert("Erreur création : " + err);
    }
  };

  const handleSave = async () => {
    if (!activeFile) return;
    try {
      const fullPath = `${VAULT_PATH}\\${activeFile}`;
      await invoke("save_note", { path: fullPath, content: activeContent });

      if (db) {
        await db.execute("UPDATE notes SET last_synced = $1 WHERE path = $2", [Date.now(), activeFile]);
      }

      setIsDirty(false);
      setSyncStatus("SAVED");
      setTimeout(() => setSyncStatus("READY"), 2000);
    } catch (err) {
      alert("Erreur sauvegarde : " + err);
    }
  };

  const handleDelete = async () => {
    if (!activeFile) return;
    if (!confirm(`ATTENTION : Supprimer définitivement "${activeFile}" ?\nCette action est irréversible.`)) return;

    try {
      const fullPath = `${VAULT_PATH}\\${activeFile}`;
      await invoke("delete_note", { path: fullPath });

      if (db) {
        await db.execute("DELETE FROM notes WHERE path = $1", [activeFile]);
      }

      setLibrary(prev => prev.filter(n => n.path !== activeFile));
      setActiveFile("");
      setActiveContent("");
      setIsDirty(false);

    } catch (err) {
      alert("Erreur suppression : " + err);
    }
  };

  return (
    <div className="h-screen w-screen bg-black text-white flex flex-col overflow-hidden font-sans">

      {/* HEADER (Barre de statut fine tout en haut) */}
      <div className="h-8 bg-gray-950 border-b border-gray-900 flex items-center justify-between px-4 select-none">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${status.includes("FAILURE") ? 'bg-red-500' : 'bg-green-500'}`}></div>
          <span className="text-gray-500 text-[10px] font-mono tracking-widest uppercase">Aegis V3 Kernel</span>
        </div>
        <div className="text-[10px] font-mono text-gray-600">
          {syncStatus}
        </div>
      </div>

      {/* MAIN WORKSPACE (3 COLONNES) */}
      <div className="flex flex-1 min-h-0">

        {/* COLONNE 1 : NAVIGATION (Gauche) */}
        <div className="w-64 bg-gray-950 border-r border-gray-900 flex flex-col">
          {/* Zone Action */}
          <div className="p-3 border-b border-gray-900 flex gap-2">
            <button onClick={handleScan} className="flex-1 bg-blue-900/20 hover:bg-blue-900/40 text-blue-400 border border-blue-900/50 py-2 rounded text-xs font-bold transition-colors">
              SYNC
            </button>
            <button onClick={handleCreate} className="w-10 bg-green-900/20 hover:bg-green-900/40 text-green-400 border border-green-900/50 py-2 rounded text-xs font-bold transition-colors">
              +
            </button>
          </div>

          {/* Liste des Notes */}
          <div className="flex-1 overflow-y-auto p-2">
            <h3 className="text-[10px] font-bold text-gray-600 uppercase mb-2 px-2 tracking-wider">Vault</h3>
            <ul className="space-y-0.5">
              {library.map((note) => (
                <li
                  key={note.id}
                  onClick={() => handleReadFile(note.path)}
                  className={`cursor-pointer px-3 py-2 rounded-md text-sm transition-all flex items-center gap-2 truncate ${activeFile === note.path
                      ? "bg-gray-800 text-white font-medium"
                      : "text-gray-400 hover:bg-gray-900 hover:text-gray-300"
                    }`}
                >
                  <span className="opacity-30 text-[10px]">📄</span>
                  <span className="truncate">{note.path.replace(".md", "")}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* COLONNE 2 : ÉDITEUR (Centre - Focus) */}
        <div className="flex-1 bg-black flex flex-col relative">
          {activeFile ? (
            <>
              {/* Toolbar Éditeur (Flottante ou fixe en haut) */}
              <div className="h-12 border-b border-gray-900 flex items-center justify-between px-6 bg-black/50 backdrop-blur">
                <span className="font-mono text-sm text-gray-200">{activeFile}</span>
                <div className="flex items-center gap-2">
                  {isDirty && <span className="text-yellow-600 text-[10px] font-bold uppercase tracking-wider mr-2">Unsaved Changes</span>}
                  <button onClick={handleSave} disabled={!isDirty} className={`text-xs px-3 py-1.5 rounded border transition-all ${isDirty ? "border-yellow-700 text-yellow-500 hover:bg-yellow-900/20" : "border-transparent text-gray-600"}`}>
                    {isDirty ? "SAVE" : "SAVED"}
                  </button>
                  <button onClick={handleDelete} className="text-xs px-3 py-1.5 rounded text-red-900 hover:text-red-500 hover:bg-red-900/10 transition-colors">
                    TRASH
                  </button>
                </div>
              </div>

              {/* Zone de Texte */}
              <textarea
                className="flex-1 w-full h-full bg-black p-8 text-gray-300 font-mono text-base resize-none focus:outline-none leading-7 max-w-4xl mx-auto"
                value={activeContent}
                onChange={(e) => { setActiveContent(e.target.value); setIsDirty(true); }}
                spellCheck={false}
                placeholder="Start typing..."
              />
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-800 select-none">
              <div className="text-6xl mb-4 opacity-10">◈</div>
            </div>
          )}
        </div>

        {/* COLONNE 3 : PILOTE (Droite - Context) */}
        <div className="w-80 bg-gray-950 border-l border-gray-900 flex flex-col p-4">
          <h3 className="text-[10px] font-bold text-gray-600 uppercase mb-4 tracking-wider border-b border-gray-900 pb-2">
            Context Pilot
          </h3>

          {/* Placeholder pour les futurs modules (Tags, Projets, IA) */}
          <div className="flex-1 flex items-center justify-center border border-dashed border-gray-900 rounded-lg">
            <p className="text-center text-gray-700 text-xs px-4">
              MODULE INACTIF<br />
              <span className="opacity-50">L'Intelligence Artificielle et les métadonnées de projet s'afficheront ici.</span>
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;
