import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import Database from "@tauri-apps/plugin-sql";

const VAULT_PATH = "D:\\AEGIS_VAULT_TEST";

// Interface pour typer nos données proprement
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

  // Changement ici : on stocke des objets Note, pas juste des strings
  const [library, setLibrary] = useState<Note[]>([]);

  const [activeContent, setActiveContent] = useState<string>("");
  const [activeFile, setActiveFile] = useState<string>("");
  const [syncStatus, setSyncStatus] = useState<string>("");
  const [isDirty, setIsDirty] = useState(false);

  // 1. Initialisation & Chargement Mémoire
  useEffect(() => {
    const init = async () => {
      try {
        const sysMsg = await invoke<string>("check_system_status");
        const database = await Database.load("sqlite:aegis.db");
        setDb(database);
        setStatus(`${sysMsg} | MEMORY: CONNECTED`);

        // CHARGEMENT IMMÉDIAT DEPUIS LA MÉMOIRE
        await loadLibrary(database);

      } catch (err) {
        console.error(err);
        setStatus("SYSTEM FAILURE: " + err);
      }
    };
    init();
  }, []);

  // Fonction pour lire la DB (Lecture seule)
  const loadLibrary = async (database: Database) => {
    try {
      // On récupère tout, trié par date de sync (le plus récent en haut)
      const notes = await database.select<Note[]>("SELECT * FROM notes ORDER BY last_synced DESC");
      setLibrary(notes);
    } catch (err) {
      console.error("Erreur chargement bibliothèque:", err);
    }
  };

  // 2. Scan & Indexation (Mise à jour Mémoire)
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

      // APRÈS LE SCAN : On rafraîchit l'affichage depuis la DB (Vérité Unique)
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
      setIsDirty(false); // <--- Important : on reset l'état quand on change de fichier
    } catch (error) {
      alert("Erreur lecture: " + error);
    }
  };

  const handleCreate = async () => {
    const name = prompt("Nom de la nouvelle note (ex: Meeting_CEO) :");
    if (!name) return;

    // On force l'extension .md si absente
    const fileName = name.endsWith(".md") ? name : `${name}.md`;
    const fullPath = `${VAULT_PATH}\\${fileName}`;

    try {
      // 1. Création Physique (Disque)
      // On crée un fichier avec un template de base
      const template = `# ${name}\n\nCreated: ${new Date().toLocaleString()}\n\n`;
      await invoke("create_note", { path: fullPath, content: template });

      // 2. Scan & Indexation Immédiate (Mise à jour Mémoire)
      // On réutilise la logique de handleScan pour être sûr que tout est synchro
      await handleScan();

      // 3. Ouverture automatique
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

      // Update timestamp in DB
      if (db) {
        await db.execute("UPDATE notes SET last_synced = $1 WHERE path = $2", [Date.now(), activeFile]);
      }

      setIsDirty(false); // Le fichier est propre
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
      // 1. Suppression Physique
      await invoke("delete_note", { path: fullPath });

      // 2. Suppression Mémoire
      if (db) {
        await db.execute("DELETE FROM notes WHERE path = $1", [activeFile]);
      }

      // 3. Mise à jour UI
      setLibrary(prev => prev.filter(n => n.path !== activeFile)); // Optimiste
      setActiveFile("");
      setActiveContent("");
      setIsDirty(false);

    } catch (err) {
      alert("Erreur suppression : " + err);
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
          <div className="flex gap-2 mb-4">
            <button
              onClick={handleScan}
              className="flex-1 bg-blue-700 hover:bg-blue-600 text-white py-3 px-3 rounded text-xs font-bold uppercase tracking-wider transition-colors shadow-lg shadow-blue-900/20"
            >
              SYNC
            </button>
            <button
              onClick={handleCreate}
              className="bg-green-700 hover:bg-green-600 text-white py-3 px-4 rounded text-xl font-bold flex items-center justify-center shadow-lg shadow-green-900/20"
            >
              +
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            <h3 className="text-xs font-bold text-gray-500 uppercase mb-2 px-1">Memory Banks ({library.length})</h3>
            <ul className="space-y-1">
              {library.map((note) => (
                <li
                  key={note.id}
                  onClick={() => handleReadFile(note.path)}
                  className={`cursor-pointer px-3 py-2 rounded text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-all flex items-center gap-2 ${activeFile === note.path ? "bg-gray-800 border-l-2 border-green-500 text-white" : ""}`}
                >
                  <span className="opacity-50 text-xs">md</span>
                  <span className="truncate">{note.path}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* EDITOR */}
        <div className="flex-1 bg-gray-950 rounded-lg border border-gray-800 p-0 overflow-hidden flex flex-col">
          {activeFile ? (
            <>
              {/* EDITOR HEADER */}
              <div className="bg-gray-900 px-6 py-3 border-b border-gray-800 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-gray-200">{activeFile}</span>
                  {isDirty && <span className="text-yellow-500 text-xs font-bold">● MODIFIED</span>}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSave}
                    disabled={!isDirty}
                    className={`text-xs font-bold px-4 py-1 rounded transition-colors ${isDirty
                        ? "bg-yellow-600 text-white hover:bg-yellow-500 cursor-pointer"
                        : "bg-gray-800 text-gray-500 cursor-not-allowed"
                      }`}
                  >
                    {isDirty ? "SAVE CHANGES" : "SAVED"}
                  </button>

                  <button
                    onClick={handleDelete}
                    className="bg-red-900/50 hover:bg-red-700 text-red-200 px-3 py-1 rounded text-xs font-bold border border-red-900 transition-colors ml-2"
                    title="Delete Note"
                  >
                    DELETE
                  </button>
                </div>
              </div>

              {/* EDITOR AREA */}
              <textarea
                className="flex-1 w-full h-full bg-gray-950 p-6 text-gray-300 font-mono text-sm resize-none focus:outline-none leading-relaxed"
                value={activeContent}
                onChange={(e) => {
                  setActiveContent(e.target.value);
                  setIsDirty(true);
                }}
                spellCheck={false}
              />
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-700 select-none">
              <div className="text-4xl mb-4 opacity-20">◈</div>
              <p className="text-xs tracking-widest uppercase">System Ready</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default App;
