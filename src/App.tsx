import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import Database from "@tauri-apps/plugin-sql";

const VAULT_PATH = "D:\\AEGIS_VAULT_TEST";
const METADATA_SEPARATOR = "\n\n--- AEGIS METADATA ---\n";

interface Note {
  id: string;
  path: string;
  last_synced: number;
  type?: string;
  status?: string;
  tags?: string;
  content?: string;
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
  const [relatedNotes, setRelatedNotes] = useState<Note[]>([]); // NOUVEAU

  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("ALL");

  const [activeFile, setActiveFile] = useState<string>("");
  const [bodyContent, setBodyContent] = useState<string>("");
  const [metadata, setMetadata] = useState<NoteMetadata>({ type: "NOTE", status: "ACTIVE", tags: "" });
  const [isDirty, setIsDirty] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>("");
  const [viewMode, setViewMode] = useState<'EDIT' | 'PREVIEW'>('PREVIEW');

  // --- PARSER ---
  const renderMarkdown = (text: string) => {
    if (!text) return null;
    return text.split('\n').map((line, lineIndex) => {
      let className = "text-gray-300 text-sm font-mono leading-7 min-h-[1.5rem]";
      let content = line;

      if (line.startsWith('# ')) { className = "text-2xl font-bold text-white mt-4 mb-2"; content = line.replace('# ', ''); }
      else if (line.startsWith('## ')) { className = "text-xl font-bold text-gray-200 mt-3 mb-1"; content = line.replace('## ', ''); }

      const parts = content.split(/(\[\[.*?\]\])/g);
      return (
        <div key={lineIndex} className={className}>
          {parts.map((part, partIndex) => {
            if (part.startsWith('[[') && part.endsWith(']]')) {
              const target = part.slice(2, -2);
              return <span key={partIndex} onClick={() => handleLinkClick(target)} className="text-blue-400 underline cursor-pointer hover:text-blue-300 font-bold bg-blue-900/20 px-1 rounded mx-0.5">{target}</span>;
            }
            return <span key={partIndex}>{part}</span>;
          })}
        </div>
      );
    });
  };

  const handleLinkClick = async (target: string) => {
    const targetFile = target.endsWith('.md') ? target : `${target}.md`;
    const exists = library.find(n => n.path === targetFile);
    if (exists) handleReadFile(targetFile);
    else if (confirm(`Créer "${targetFile}" ?`)) createNoteDirect(targetFile);
  };

  const createNoteDirect = async (fileName: string) => {
    const fullPath = `${VAULT_PATH}\\${fileName}`;
    try {
      const template = `# ${fileName.replace('.md', '')}\n\nCreated automatically.`;
      await invoke("create_note", { path: fullPath, content: template });
      await handleScan();
      handleReadFile(fileName);
    } catch (err) { alert(err); }
  };

  const parseFileContent = (rawText: string) => {
    if (rawText.includes(METADATA_SEPARATOR)) {
      const [body, metaBlock] = rawText.split(METADATA_SEPARATOR);
      const metaLines = metaBlock.split("\n");
      const newMeta = { type: "NOTE", status: "ACTIVE", tags: "" };
      metaLines.forEach(line => {
        if (line.startsWith("TYPE:")) newMeta.type = line.replace("TYPE:", "").trim();
        if (line.startsWith("STATUS:")) newMeta.status = line.replace("STATUS:", "").trim();
        if (line.startsWith("TAGS:")) newMeta.tags = line.replace("TAGS:", "").trim();
      });
      setBodyContent(body);
      setMetadata(newMeta);
      return newMeta; // Retourne les metas pour usage immédiat
    } else {
      setBodyContent(rawText);
      const defaultMeta = { type: "NOTE", status: "ACTIVE", tags: "" };
      setMetadata(defaultMeta);
      return defaultMeta;
    }
  };

  const constructFileContent = () => {
    let metaBlock = `TYPE: ${metadata.type}\nSTATUS: ${metadata.status}\nTAGS: ${metadata.tags}`;
    return `${bodyContent}${METADATA_SEPARATOR}${metaBlock}`;
  };

  // --- INIT ---
  useEffect(() => {
    const init = async () => {
      try {
        const sysMsg = await invoke<string>("check_system_status");
        const database = await Database.load("sqlite:aegis.db");
        setDb(database);
        setStatus(`${sysMsg} | MEMORY: CONNECTED`);
        await loadLibrary(database, "", "ALL");
      } catch (err) { setStatus("SYSTEM FAILURE: " + err); }
    };
    init();
  }, []);

  const loadLibrary = async (database: Database, query: string, type: string) => {
    try {
      let sql = "SELECT * FROM notes WHERE 1=1";
      const params: any[] = [];
      if (query) { sql += " AND (path LIKE $1 OR tags LIKE $1 OR content LIKE $1)"; params.push(`%${query}%`); }
      if (type !== "ALL") { const paramIndex = params.length + 1; sql += ` AND type = $${paramIndex}`; params.push(type); }
      sql += " ORDER BY last_synced DESC";
      const notes = await database.select<Note[]>(sql, params);
      setLibrary(notes);
    } catch (err) { console.error(err); }
  };

  // NOUVEAU : INTELLIGENCE ASSOCIATIVE
  const findRelatedNotes = async (currentFile: string, tags: string, database: Database) => {
    if (!tags) { setRelatedNotes([]); return; }

    // On nettoie les tags (ex: "strat, q1" -> ["strat", "q1"])
    const tagList = tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
    if (tagList.length === 0) { setRelatedNotes([]); return; }

    // Construction requête SQL dynamique : (tags LIKE %t1% OR tags LIKE %t2%)
    let sql = "SELECT * FROM notes WHERE path != $1 AND (";
    const params: any[] = [currentFile];

    tagList.forEach((tag, index) => {
      if (index > 0) sql += " OR ";
      sql += `tags LIKE $${index + 2}`;
      params.push(`%${tag}%`);
    });
    sql += ") ORDER BY last_synced DESC LIMIT 5";

    try {
      const results = await database.select<Note[]>(sql, params);
      setRelatedNotes(results);
    } catch (err) { console.error("Auto-Link Error", err); }
  };

  useEffect(() => { if (db) loadLibrary(db, searchQuery, filterType); }, [searchQuery, filterType, db]);

  const handleScan = async () => {
    if (!db) return;
    setSyncStatus("INDEXING...");
    try {
      const entries = await invoke<[string, string][]>("read_all_files", { path: VAULT_PATH });
      let newCount = 0;
      for (const [fileName, content] of entries) {
        let cleanBody = content;
        let type = "NOTE", status = "ACTIVE", tags = "";
        if (content.includes(METADATA_SEPARATOR)) {
          const parts = content.split(METADATA_SEPARATOR);
          cleanBody = parts[0];
          const partsMeta = parts[1].split("\n");
          partsMeta.forEach(line => {
            if (line.startsWith("TYPE:")) type = line.replace("TYPE:", "").trim();
            if (line.startsWith("STATUS:")) status = line.replace("STATUS:", "").trim();
            if (line.startsWith("TAGS:")) tags = line.replace("TAGS:", "").trim();
          });
        }
        const exists = await db.select<any[]>("SELECT id FROM notes WHERE path = $1", [fileName]);
        if (exists.length === 0) {
          await db.execute("INSERT INTO notes (id, path, last_synced, content, type, status, tags) VALUES ($1, $2, $3, $4, $5, $6, $7)", [generateSimpleId(), fileName, Date.now(), cleanBody, type, status, tags]);
          newCount++;
        } else {
          await db.execute("UPDATE notes SET last_synced=$1, content=$2, type=$3, status=$4, tags=$5 WHERE path=$6", [Date.now(), cleanBody, type, status, tags, fileName]);
        }
      }
      setSyncStatus(`INDEX UPDATED`);
      await loadLibrary(db, searchQuery, filterType);
    } catch (error) { setSyncStatus("INDEX ERROR"); }
  };

  const handleCreate = async () => {
    const name = prompt("Nom :");
    if (!name) return;
    const fileName = name.endsWith(".md") ? name : `${name}.md`;
    createNoteDirect(fileName);
  };

  const handleReadFile = async (fileName: string) => {
    try {
      const fullPath = `${VAULT_PATH}\\${fileName}`;
      const content = await invoke<string>("read_note", { path: fullPath });
      const newMeta = parseFileContent(content); // Récupère les tags
      setActiveFile(fileName);
      setIsDirty(false);
      setViewMode('PREVIEW'); // Open in preview mode by default

      // LANCE L'INTELLIGENCE
      if (db) findRelatedNotes(fileName, newMeta.tags, db);

    } catch (error) { alert(error); }
  };

  const handleSave = async () => {
    if (!activeFile) return;
    try {
      const fullPath = `${VAULT_PATH}\\${activeFile}`;
      const finalContent = constructFileContent();
      await invoke("save_note", { path: fullPath, content: finalContent });
      if (db) {
        await db.execute("UPDATE notes SET last_synced = $1, type = $2, status = $3, tags = $4, content = $5 WHERE path = $6", [Date.now(), metadata.type, metadata.status, metadata.tags, bodyContent, activeFile]);
        await loadLibrary(db, searchQuery, filterType);
        // Refresh relations
        findRelatedNotes(activeFile, metadata.tags, db);
      }
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
      setActiveFile(""); setBodyContent(""); setIsDirty(false);
    } catch (err) { alert(err); }
  };

  return (
    <div className="h-screen w-screen bg-black text-white flex flex-col overflow-hidden font-sans">
      <div className="h-8 bg-gray-950 border-b border-gray-900 flex items-center justify-between px-4 select-none">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${status.includes("FAILURE") ? 'bg-red-500' : 'bg-green-500'}`}></div>
          <span className="text-gray-500 text-[10px] font-mono tracking-widest uppercase">Aegis V3 Kernel</span>
        </div>
        <div className="text-[10px] font-mono text-gray-600">{syncStatus}</div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* COLONNE 1 */}
        <div className="w-64 bg-gray-950 border-r border-gray-900 flex flex-col">
          <div className="p-3 flex gap-2">
            <button onClick={handleScan} className="flex-1 bg-blue-900/20 hover:bg-blue-900/40 text-blue-400 border border-blue-900/50 py-2 rounded text-xs font-bold transition-colors">SYNC</button>
            <button onClick={handleCreate} className="w-10 bg-green-900/20 hover:bg-green-900/40 text-green-400 border border-green-900/50 py-2 rounded text-xs font-bold transition-colors">+</button>
          </div>
          <div className="px-3 pb-3 border-b border-gray-900">
            <input type="text" placeholder="Search..." className="w-full bg-black border border-gray-800 rounded px-2 py-1 text-xs text-gray-300 focus:border-blue-500 focus:outline-none mb-2" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            <div className="flex gap-1">
              {['ALL', 'PROJECT', 'TASK'].map(f => (<button key={f} onClick={() => setFilterType(f)} className={`flex-1 py-1 text-[10px] font-bold rounded ${filterType === f ? "bg-gray-800 text-white" : "text-gray-600 hover:bg-gray-900"}`}>{f === 'ALL' ? 'ALL' : f === 'PROJECT' ? 'PROJ' : 'TASK'}</button>))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <ul className="space-y-0.5">
              {library.map((note) => (
                <li key={note.id} onClick={() => handleReadFile(note.path)} className={`cursor-pointer px-3 py-2 rounded-md text-sm transition-all flex items-center gap-2 truncate ${activeFile === note.path ? "bg-gray-800 text-white font-medium" : "text-gray-400 hover:bg-gray-900 hover:text-gray-300"}`}>
                  <span className="opacity-70 text-[10px] mr-2">{note.type === 'PROJECT' ? '📁' : note.type === 'TASK' ? '☑️' : '📄'}</span>
                  <span className={`truncate ${note.status === 'DONE' ? 'line-through opacity-50' : ''}`}>{note.path.replace(".md", "")}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* COLONNE 2 */}
        <div className="flex-1 bg-black flex flex-col relative">
          {activeFile ? (
            <>
              <div className="h-12 border-b border-gray-900 flex items-center justify-between px-6 bg-black/50 backdrop-blur">
                <span className="font-mono text-sm text-gray-200">{activeFile}</span>
                <div className="flex items-center gap-2">
                  <div className="flex bg-gray-900 rounded p-0.5 mr-4">
                    <button onClick={() => setViewMode('PREVIEW')} className={`px-3 py-1 text-[10px] font-bold rounded ${viewMode === 'PREVIEW' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}>READ</button>
                    <button onClick={() => setViewMode('EDIT')} className={`px-3 py-1 text-[10px] font-bold rounded ${viewMode === 'EDIT' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}>EDIT</button>
                  </div>
                  {isDirty && <span className="text-yellow-600 text-[10px] font-bold uppercase tracking-wider mr-2">Unsaved</span>}
                  <button onClick={handleSave} disabled={!isDirty} className={`text-xs px-3 py-1.5 rounded border transition-all ${isDirty ? "border-yellow-700 text-yellow-500 hover:bg-yellow-900/20" : "border-transparent text-gray-600"}`}>{isDirty ? "SAVE" : "SAVED"}</button>
                  <button onClick={handleDelete} className="text-xs px-3 py-1.5 rounded text-red-900 hover:text-red-500 hover:bg-red-900/10 transition-colors">TRASH</button>
                </div>
              </div>

              {viewMode === 'EDIT' ? (
                <textarea
                  className="flex-1 w-full h-full bg-black p-8 text-gray-300 font-mono text-base resize-none focus:outline-none leading-7 max-w-4xl mx-auto"
                  value={bodyContent}
                  onChange={(e) => { setBodyContent(e.target.value); setIsDirty(true); }}
                  spellCheck={false}
                  placeholder="Start typing..."
                />
              ) : (
                <div className="flex-1 w-full h-full bg-black p-8 overflow-y-auto max-w-4xl mx-auto">
                  {renderMarkdown(bodyContent)}
                </div>
              )}
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-800 select-none"><div className="text-6xl mb-4 opacity-10">◈</div></div>
          )}
        </div>

        {/* COLONNE 3 : CONTEXT PILOT */}
        <div className="w-80 bg-gray-950 border-l border-gray-900 flex flex-col p-6 gap-6">
          <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-900 pb-2">Context Pilot</h3>
          {activeFile ? (
            <>
              <div>
                <label className="text-[10px] text-gray-600 font-bold uppercase mb-2 block">Project Status</label>
                <select value={metadata.status} onChange={(e) => { setMetadata({ ...metadata, status: e.target.value }); setIsDirty(true); }} className="w-full bg-gray-900 border border-gray-800 text-gray-300 text-xs rounded p-2 focus:border-blue-500 focus:outline-none">
                  <option value="ACTIVE">🟢 ACTIVE</option>
                  <option value="HOLD">🟠 ON HOLD</option>
                  <option value="DONE">🔵 COMPLETED</option>
                  <option value="ARCHIVED">⚫ ARCHIVED</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-gray-600 font-bold uppercase mb-2 block">Entry Type</label>
                <div className="flex gap-2">
                  {['NOTE', 'PROJECT', 'TASK'].map(type => (
                    <button key={type} onClick={() => { setMetadata({ ...metadata, type }); setIsDirty(true); }} className={`flex-1 py-2 text-[10px] font-bold rounded border ${metadata.type === type ? "bg-blue-900/30 border-blue-800 text-blue-400" : "bg-gray-900 border-gray-800 text-gray-500 hover:bg-gray-800"}`}>{type}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] text-gray-600 font-bold uppercase mb-2 block">Tags</label>
                <input type="text" value={metadata.tags} onChange={(e) => { setMetadata({ ...metadata, tags: e.target.value }); setIsDirty(true); }} className="w-full bg-gray-900 border border-gray-800 text-gray-300 text-xs rounded p-2 focus:border-blue-500 focus:outline-none font-mono" placeholder="tag1, tag2" />
              </div>

              {/* NEW: RELATED INTELLIGENCE */}
              <div className="mt-4 pt-4 border-t border-gray-900">
                <label className="text-[10px] text-blue-500 font-bold uppercase mb-3 block tracking-wider">Related Intelligence</label>
                {relatedNotes.length > 0 ? (
                  <ul className="space-y-2">
                    {relatedNotes.map(note => (
                      <li key={note.id} onClick={() => handleReadFile(note.path)} className="cursor-pointer p-2 rounded bg-gray-900/50 hover:bg-gray-900 border border-gray-800 flex items-center gap-2">
                        <span className="text-[10px] opacity-50">{note.type === 'PROJECT' ? '📁' : '📄'}</span>
                        <span className="text-xs text-gray-300 truncate">{note.path.replace('.md', '')}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[10px] text-gray-700 italic">No connections found in database.</p>
                )}
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
