import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import Database from "@tauri-apps/plugin-sql";

const VAULT_PATH = "D:\\AEGIS_VAULT_TEST";
const METADATA_SEPARATOR = "\n\n--- AEGIS METADATA ---\n";

interface Note {
  id: string;
  path: string;
  last_synced: number;
}

interface NoteMetadata {
  type: string;
  status: string;
  tags: string;
}

function generateSimpleId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function App() {
  const [status, setStatus] = useState<string>("INITIALIZING...");
  const [db, setDb] = useState<Database | null>(null);
  const [library, setLibrary] = useState<Note[]>([]);

  // EDITOR STATES
  const [activeFile, setActiveFile] = useState<string>("");
  const [bodyContent, setBodyContent] = useState<string>(""); // Le texte pur
  const [metadata, setMetadata] = useState<NoteMetadata>({ type: "NOTE", status: "ACTIVE", tags: "" }); // Les infos contextuelles
  const [isDirty, setIsDirty] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>("");

  // --- LOGIQUE DE PARSING (LE CERVEAU) ---
  const parseFileContent = (rawText: string) => {
    if (rawText.includes(METADATA_SEPARATOR)) {
      const [body, metaBlock] = rawText.split(METADATA_SEPARATOR);

      // Extraction basique des clés/valeurs (Key: Value)
      const metaLines = metaBlock.split("\n");
      const newMeta = { type: "NOTE", status: "ACTIVE", tags: "" };

      metaLines.forEach(line => {
        if (line.startsWith("TYPE:")) newMeta.type = line.replace("TYPE:", "").trim();
        if (line.startsWith("STATUS:")) newMeta.status = line.replace("STATUS:", "").trim();
        if (line.startsWith("TAGS:")) newMeta.tags = line.replace("TAGS:", "").trim();
      });

      setBodyContent(body);
      setMetadata(newMeta);
    } else {
      // Pas de métadonnées, c'est un fichier "vierge"
      setBodyContent(rawText);
      setMetadata({ type: "NOTE", status: "ACTIVE", tags: "" });
    }
  };

  const constructFileContent = () => {
    let metaBlock = `TYPE: ${metadata.type}\nSTATUS: ${metadata.status}\nTAGS: ${metadata.tags}`;
    return `${bodyContent}${METADATA_SEPARATOR}${metaBlock}`;
  };
  // ----------------------------------------

  useEffect(() => {
    const init = async () => {
      try {
        const sysMsg = await invoke<string>("check_system_status");
        const database = await Database.load("sqlite:aegis.db");
        setDb(database);
        setStatus(`${sysMsg} | MEMORY: CONNECTED`);
        await loadLibrary(database);
      } catch (err) {
        setStatus("SYSTEM FAILURE: " + err);
      }
    };
    init();
  }, []);

  const loadLibrary = async (database: Database) => {
    try {
      const notes = await database.select<Note[]>("SELECT * FROM notes ORDER BY last_synced DESC");
      setLibrary(notes);
    } catch (err) { console.error(err); }
  };

  const handleScan = async () => {
    if (!db) return;
    setSyncStatus("SCANNING...");
    try {
      const fileList = await invoke<string[]>("scan_vault", { path: VAULT_PATH });
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
    } catch (error) { setSyncStatus("SYNC ERROR"); }
  };

  const handleCreate = async () => {
    const name = prompt("Nom de la note :");
    if (!name) return;
    const fileName = name.endsWith(".md") ? name : `${name}.md`;
    const fullPath = `${VAULT_PATH}\\${fileName}`;
    try {
      const template = `# ${name}\n\nCreated: ${new Date().toLocaleString()}`; // Pas de métadata à la création, on l'ajoute au save
      await invoke("create_note", { path: fullPath, content: template });
      await handleScan();
      handleReadFile(fileName);
    } catch (err) { alert(err); }
  };

  const handleReadFile = async (fileName: string) => {
    try {
      const fullPath = `${VAULT_PATH}\\${fileName}`;
      const content = await invoke<string>("read_note", { path: fullPath });

      // On parse au lieu de juste afficher
      parseFileContent(content);

      setActiveFile(fileName);
      setIsDirty(false);
    } catch (error) { alert(error); }
  };

  const handleSave = async () => {
    if (!activeFile) return;
    try {
      const fullPath = `${VAULT_PATH}\\${activeFile}`;

      // On reconstruit le fichier complet (Corps + Footer)
      const finalContent = constructFileContent();

      await invoke("save_note", { path: fullPath, content: finalContent });

      if (db) await db.execute("UPDATE notes SET last_synced = $1 WHERE path = $2", [Date.now(), activeFile]);

      setIsDirty(false);
      setSyncStatus("SAVED");
      setTimeout(() => setSyncStatus("READY"), 2000);
    } catch (err) { alert(err); }
  };

  const handleDelete = async () => {
    if (!activeFile || !confirm("Supprimer ?")) return;
    try {
      await invoke("delete_note", { path: `${VAULT_PATH}\\${activeFile}` });
      if (db) await db.execute("DELETE FROM notes WHERE path = $1", [activeFile]);
      setLibrary(prev => prev.filter(n => n.path !== activeFile));
      setActiveFile("");
      setBodyContent("");
      setIsDirty(false);
    } catch (err) { alert(err); }
  };

  return (
    <div className="h-screen w-screen bg-black text-white flex flex-col overflow-hidden font-sans">

      {/* HEADER */}
      <div className="h-8 bg-gray-950 border-b border-gray-900 flex items-center justify-between px-4 select-none">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${status.includes("FAILURE") ? 'bg-red-500' : 'bg-green-500'}`}></div>
          <span className="text-gray-500 text-[10px] font-mono tracking-widest uppercase">Aegis V3 Kernel</span>
        </div>
        <div className="text-[10px] font-mono text-gray-600">{syncStatus}</div>
      </div>

      <div className="flex flex-1 min-h-0">

        {/* COLONNE 1 : VAULT */}
        <div className="w-64 bg-gray-950 border-r border-gray-900 flex flex-col">
          <div className="p-3 border-b border-gray-900 flex gap-2">
            <button onClick={handleScan} className="flex-1 bg-blue-900/20 hover:bg-blue-900/40 text-blue-400 border border-blue-900/50 py-2 rounded text-xs font-bold">SYNC</button>
            <button onClick={handleCreate} className="w-10 bg-green-900/20 hover:bg-green-900/40 text-green-400 border border-green-900/50 py-2 rounded text-xs font-bold">+</button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <ul className="space-y-0.5">
              {library.map((note) => (
                <li key={note.id} onClick={() => handleReadFile(note.path)} className={`cursor-pointer px-3 py-2 rounded-md text-sm truncate ${activeFile === note.path ? "bg-gray-800 text-white font-medium" : "text-gray-400 hover:bg-gray-900"}`}>
                  <span className="opacity-30 text-[10px] mr-2">DOC</span>{note.path.replace(".md", "")}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* COLONNE 2 : EDITOR */}
        <div className="flex-1 bg-black flex flex-col relative">
          {activeFile ? (
            <>
              <div className="h-12 border-b border-gray-900 flex items-center justify-between px-6 bg-black/50">
                <span className="font-mono text-sm text-gray-200">{activeFile}</span>
                <div className="flex items-center gap-2">
                  {isDirty && <span className="text-yellow-600 text-[10px] font-bold uppercase mr-2">Unsaved Changes</span>}
                  <button onClick={handleSave} disabled={!isDirty} className={`text-xs px-3 py-1.5 rounded border transition-all ${isDirty ? "border-yellow-700 text-yellow-500" : "border-transparent text-gray-600"}`}>{isDirty ? "SAVE" : "SAVED"}</button>
                  <button onClick={handleDelete} className="text-xs px-3 py-1.5 rounded text-red-900 hover:text-red-500">TRASH</button>
                </div>
              </div>
              <textarea
                className="flex-1 w-full h-full bg-black p-8 text-gray-300 font-mono text-base resize-none focus:outline-none leading-7 max-w-4xl mx-auto"
                value={bodyContent}
                onChange={(e) => { setBodyContent(e.target.value); setIsDirty(true); }}
                spellCheck={false}
                placeholder="Start typing..."
              />
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-800"><div className="text-6xl mb-4 opacity-10">◈</div></div>
          )}
        </div>

        {/* COLONNE 3 : CONTEXT PILOT (ACTIVÉ) */}
        <div className="w-80 bg-gray-950 border-l border-gray-900 flex flex-col p-6 gap-6">
          <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-900 pb-2">Context Pilot</h3>

          {activeFile ? (
            <>
              {/* STATUS SELECTOR */}
              <div>
                <label className="text-[10px] text-gray-600 font-bold uppercase mb-2 block">Project Status</label>
                <select
                  value={metadata.status}
                  onChange={(e) => { setMetadata({ ...metadata, status: e.target.value }); setIsDirty(true); }}
                  className="w-full bg-gray-900 border border-gray-800 text-gray-300 text-xs rounded p-2 focus:border-blue-500 focus:outline-none"
                >
                  <option value="ACTIVE">🟢 ACTIVE</option>
                  <option value="HOLD">🟠 ON HOLD</option>
                  <option value="DONE">🔵 COMPLETED</option>
                  <option value="ARCHIVED">⚫ ARCHIVED</option>
                </select>
              </div>

              {/* TYPE SELECTOR */}
              <div>
                <label className="text-[10px] text-gray-600 font-bold uppercase mb-2 block">Entry Type</label>
                <div className="flex gap-2">
                  {['NOTE', 'PROJECT', 'TASK'].map(type => (
                    <button
                      key={type}
                      onClick={() => { setMetadata({ ...metadata, type }); setIsDirty(true); }}
                      className={`flex-1 py-2 text-[10px] font-bold rounded border ${metadata.type === type ? "bg-blue-900/30 border-blue-800 text-blue-400" : "bg-gray-900 border-gray-800 text-gray-500 hover:bg-gray-800"}`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* TAGS INPUT */}
              <div>
                <label className="text-[10px] text-gray-600 font-bold uppercase mb-2 block">Tags (comma separated)</label>
                <input
                  type="text"
                  value={metadata.tags}
                  onChange={(e) => { setMetadata({ ...metadata, tags: e.target.value }); setIsDirty(true); }}
                  className="w-full bg-gray-900 border border-gray-800 text-gray-300 text-xs rounded p-2 focus:border-blue-500 focus:outline-none font-mono"
                  placeholder="strategy, q1, urgent"
                />
              </div>

              {/* INFO BOX */}
              <div className="bg-gray-900/50 p-4 rounded border border-gray-900 mt-auto">
                <p className="text-[10px] text-gray-500 leading-relaxed">
                  <span className="text-gray-400 font-bold">Aegis Intelligence:</span><br />
                  Les métadonnées sont stockées directement dans le fichier (Footer). Aucune dépendance externe.
                </p>
              </div>
            </>
          ) : (
            <div className="text-center text-gray-700 text-xs mt-10">No context available.</div>
          )}
        </div>

      </div>
    </div>
  );
}

export default App;
