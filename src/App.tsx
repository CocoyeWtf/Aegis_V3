import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import Database from "@tauri-apps/plugin-sql";

const VAULT_PATH = "D:\\AEGIS_VAULT_TEST";
const METADATA_SEPARATOR = "\n\n--- AEGIS METADATA ---\n";
const ACTION_HEADER = "\n\n## PLAN D'ACTION\n";

interface FileNode { path: string; name: string; is_dir: boolean; extension: string; content: string; }
interface NoteMetadata { type: string; status: string; tags: string; }
interface ActionItem {
  id: string;
  code: string;
  status: boolean;
  created: string;
  deadline: string;
  owner: string;
  task: string;
  note_path?: string;
}
interface Note { id: string; path: string; tags?: string; } // Pour Related Notes

function generateSimpleId() { return Date.now().toString(36) + Math.random().toString(36).substr(2); }
function getTodayDate() { return new Date().toISOString().split('T')[0]; }
function getCurrentDateTime() { return new Date().toLocaleString(); }

function App() {
  const [status, setStatus] = useState<string>("BOOTING...");
  const [db, setDb] = useState<Database | null>(null);

  const [currentTab, setCurrentTab] = useState<'COCKPIT' | 'MASTER_PLAN'>('COCKPIT');
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [globalActions, setGlobalActions] = useState<ActionItem[]>([]);

  const [activeFile, setActiveFile] = useState<string>("");
  const [bodyContent, setBodyContent] = useState<string>("");
  const [localActions, setLocalActions] = useState<ActionItem[]>([]);
  const [metadata, setMetadata] = useState<NoteMetadata>({ type: "NOTE", status: "ACTIVE", tags: "" });
  const [relatedNotes, setRelatedNotes] = useState<Note[]>([]); // RETOUR DU CONTEXTE

  const [isDirty, setIsDirty] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>("");
  const [viewMode, setViewMode] = useState<'EDIT' | 'PREVIEW'>('EDIT');

  // --- PARSERS ---
  const parseFullFile = (rawText: string, filePath: string) => {
    let text = rawText;
    let meta = { type: "NOTE", status: "ACTIVE", tags: "" };
    let actions: ActionItem[] = [];

    // A. MÉTADONNÉES
    if (text.includes(METADATA_SEPARATOR)) {
      const parts = text.split(METADATA_SEPARATOR);
      text = parts[0];
      parts[1].split("\n").forEach(line => {
        if (line.startsWith("TYPE:")) meta.type = line.replace("TYPE:", "").trim();
        if (line.startsWith("STATUS:")) meta.status = line.replace("STATUS:", "").trim();
        if (line.startsWith("TAGS:")) meta.tags = line.replace("TAGS:", "").trim();
      });
    }

    // B. ACTIONS
    if (text.includes(ACTION_HEADER)) {
      const parts = text.split(ACTION_HEADER);
      text = parts[0];
      const lines = parts[1].split("\n");
      lines.forEach(line => {
        if (line.trim().startsWith("|") && !line.includes("---") && !line.includes("| ID |")) {
          const cols = line.split("|").map(c => c.trim());
          if (cols.length >= 7) {
            actions.push({
              id: generateSimpleId(),
              code: cols[1] || "",
              status: cols[2].toLowerCase().includes("x"),
              created: cols[3],
              deadline: cols[4],
              owner: cols[5],
              task: cols[6],
              note_path: filePath
            });
          }
        }
      });
    }
    actions.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' }));
    setBodyContent(text.trim());
    setMetadata(meta);
    setLocalActions(actions);

    // Lance la recherche de liens
    if (db) findRelatedNotes(filePath, meta.tags, db);
  };

  const constructFullFile = () => {
    let file = bodyContent + "\n";
    if (localActions.length > 0) {
      const sortedActions = [...localActions].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
      file += ACTION_HEADER;
      file += "| ID | Etat | Créé le | Deadline | Pilote | Action |\n";
      file += "| :--- | :---: | :--- | :--- | :--- | :--- |\n";
      sortedActions.forEach(a => {
        file += `| ${a.code} | [${a.status ? 'x' : ' '}] | ${a.created} | ${a.deadline} | ${a.owner} | ${a.task} |\n`;
      });
    }
    file += METADATA_SEPARATOR;
    file += `TYPE: ${metadata.type}\nSTATUS: ${metadata.status}\nTAGS: ${metadata.tags}`;
    return file;
  };

  // --- INIT ---
  useEffect(() => {
    const init = async () => {
      try {
        const sysMsg = await invoke<string>("check_system_status");
        const database = await Database.load("sqlite:aegis_v4.db");
        setDb(database);
        setStatus(`${sysMsg}`);
        handleScan(database);
      } catch (err) { setStatus("SYSTEM FAILURE"); }
    };
    init();
  }, []);

  // --- INTELLIGENCE (RETOUR) ---
  const findRelatedNotes = async (currentFile: string, tags: string, database: Database) => {
    if (!tags) { setRelatedNotes([]); return; }
    const tagList = tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
    if (tagList.length === 0) { setRelatedNotes([]); return; }

    let sql = "SELECT id, path, tags FROM notes WHERE path != $1 AND (";
    const params: any[] = [currentFile];
    tagList.forEach((tag, index) => {
      if (index > 0) sql += " OR ";
      sql += `tags LIKE $${index + 2}`;
      params.push(`%${tag}%`);
    });
    sql += ") ORDER BY last_synced DESC LIMIT 5";

    try { const results = await database.select<Note[]>(sql, params); setRelatedNotes(results); }
    catch (err) { console.error(err); }
  };

  // --- ACTIONS LOGIC ---
  const addAction = (parentId?: string) => {
    let newCode = "";
    if (parentId) {
      const siblings = localActions.filter(a => a.code.startsWith(parentId + "."));
      // On doit trouver le prochain index. Simple count ne suffit pas si on supprime.
      // Pour MVP on fait count + 1.
      const nextIndex = siblings.length + 1;
      newCode = `${parentId}.${nextIndex}`;
    } else {
      const rootActions = localActions.filter(a => !a.code.includes("."));
      newCode = (rootActions.length + 1).toString();
    }

    setLocalActions([...localActions, {
      id: generateSimpleId(), code: newCode, status: false, created: getTodayDate(), deadline: "",
      owner: "", task: ""
    }]);
    setIsDirty(true);
  };

  const updateAction = (id: string, field: keyof ActionItem, value: any) => {
    setLocalActions(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
    setIsDirty(true);
  };
  const removeAction = (id: string) => {
    setLocalActions(prev => prev.filter(a => a.id !== id));
    setIsDirty(true);
  };

  // --- SYNC ENGINE ---
  const handleScan = async (databaseInstance?: Database) => {
    const database = databaseInstance || db;
    if (!database) return;
    setSyncStatus("SYNCING...");
    try {
      const nodes = await invoke<FileNode[]>("scan_vault_recursive", { root: VAULT_PATH });
      nodes.sort((a, b) => a.path.localeCompare(b.path));
      setFileTree(nodes);

      await database.execute("DELETE FROM actions");
      let actionCount = 0;

      for (const node of nodes) {
        if (node.is_dir || node.extension !== "md") continue;

        let cleanBody = node.content;
        let type = "NOTE", status = "ACTIVE", tags = "";
        if (node.content.includes(METADATA_SEPARATOR)) {
          const parts = node.content.split(METADATA_SEPARATOR);
          cleanBody = parts[0];
          parts[1].split("\n").forEach(line => {
            if (line.startsWith("TYPE:")) type = line.replace("TYPE:", "").trim();
            if (line.startsWith("STATUS:")) status = line.replace("STATUS:", "").trim();
            if (line.startsWith("TAGS:")) tags = line.replace("TAGS:", "").trim();
          });
        }

        const exists = await database.select<any[]>("SELECT id FROM notes WHERE path = $1", [node.path]);
        if (exists.length === 0) {
          await database.execute("INSERT INTO notes (id, path, last_synced, content, type, status, tags) VALUES ($1, $2, $3, $4, $5, $6, $7)",
            [generateSimpleId(), node.path, Date.now(), cleanBody, type, status, tags]);
        } else {
          await database.execute("UPDATE notes SET last_synced=$1, content=$2, type=$3, status=$4, tags=$5 WHERE path=$6",
            [Date.now(), cleanBody, type, status, tags, node.path]);
        }

        if (node.content.includes(ACTION_HEADER)) {
          const parts = node.content.split(ACTION_HEADER);
          const lines = parts[1].split("\n");
          for (const line of lines) {
            if (line.trim().startsWith("|") && !line.includes("---") && !line.includes("| ID |")) {
              const cols = line.split("|").map(c => c.trim());
              if (cols.length >= 7) {
                await database.execute(
                  "INSERT INTO actions (id, note_path, code, status, task, owner, created_at, deadline, comment) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
                  [generateSimpleId(), node.path, cols[1], cols[2].includes("x") ? 'DONE' : 'TODO', cols[6], cols[5], cols[3], cols[4], ""]
                );
                actionCount++;
              }
            }
          }
        }
      }
      setSyncStatus(`OK (${actionCount} actions)`);
      const allActions = await database.select<any[]>("SELECT * FROM actions ORDER BY deadline ASC");
      setGlobalActions(allActions);
    } catch (error) { console.error(error); setSyncStatus("SYNC ERROR"); }
  };

  const handleSave = async () => {
    if (!activeFile) return;
    try {
      const fullPath = `${VAULT_PATH}\\${activeFile.replace(/\//g, '\\')}`;
      const finalContent = constructFullFile();
      await invoke("save_note", { path: fullPath, content: finalContent });
      await handleScan(); setIsDirty(false);
    } catch (err) { alert(err); }
  };

  const handleFileClick = async (node: FileNode) => {
    if (node.is_dir) return;
    if (node.extension === 'md') {
      setActiveFile(node.path);
      parseFullFile(node.content, node.path);
      setIsDirty(false);
      setCurrentTab('COCKPIT');
    } else {
      try { await invoke("open_external_file", { path: `${VAULT_PATH}\\${node.path.replace(/\//g, '\\')}` }); } catch (e) { alert(e); }
    }
  };

  const handleCreate = async () => {
    const name = prompt("Nom :"); if (!name) return;
    const fileName = name.endsWith(".md") ? name : `${name}.md`;
    const fullPath = `${VAULT_PATH}\\${fileName.replace(/\//g, '\\')}`;
    const date = getCurrentDateTime();
    // RESTAURATION DU TEMPLATE COMPLET
    const template = `# ${fileName.replace('.md', '')}\n\nCreated: ${date}\n\n`;
    try { await invoke("create_note", { path: fullPath, content: template }); await handleScan(); } catch (e) { alert(e); }
  };

  const renderMarkdown = (text: string) => { if (!text) return null; return <pre className="whitespace-pre-wrap font-sans text-gray-300">{text}</pre>; };

  return (
    <div className="h-screen w-screen bg-black text-white flex flex-col overflow-hidden font-sans">

      {/* HEADER */}
      <div className="h-10 bg-gray-950 border-b border-gray-900 flex items-center justify-between px-4 select-none">
        <div className="flex items-center gap-6">
          <span className="text-gray-500 text-xs font-bold tracking-widest uppercase flex gap-2 items-center">
            <div className={`w-2 h-2 rounded-full ${status.includes("FAILURE") ? 'bg-red-500' : 'bg-green-500'}`}></div>
            AEGIS V3.3
          </span>
          <div className="flex gap-1 bg-gray-900 p-1 rounded">
            <button onClick={() => setCurrentTab('COCKPIT')} className={`px-4 py-1 text-xs font-bold rounded ${currentTab === 'COCKPIT' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}>COCKPIT</button>
            <button onClick={() => setCurrentTab('MASTER_PLAN')} className={`px-4 py-1 text-xs font-bold rounded ${currentTab === 'MASTER_PLAN' ? 'bg-purple-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}>MASTER PLAN</button>
          </div>
        </div>
        <div className="text-[10px] font-mono text-gray-600">{syncStatus}</div>
      </div>

      <div className="flex flex-1 min-h-0">

        {/* SIDEBAR GAUCHE */}
        <div className="w-64 bg-gray-950 border-r border-gray-900 flex flex-col">
          <div className="p-3 flex gap-2">
            <button onClick={() => handleScan()} className="flex-1 bg-blue-900/20 hover:bg-blue-900/40 text-blue-400 border border-blue-900/50 py-2 rounded text-xs font-bold">RE-SYNC</button>
            <button onClick={handleCreate} className="w-10 bg-green-900/20 hover:bg-green-900/40 text-green-400 border border-green-900/50 py-2 rounded text-xs font-bold">+</button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {fileTree.map((node) => (
              <div key={node.path} onClick={() => handleFileClick(node)} style={{ paddingLeft: `${(node.path.split('/').length - 1) * 12 + 8}px` }} className={`cursor-pointer py-1.5 rounded text-sm flex items-center gap-2 truncate hover:bg-gray-900 ${activeFile === node.path ? "bg-gray-800 text-white" : "text-gray-400"}`}>
                <span className="opacity-70 text-xs">{node.is_dir ? '📂' : node.extension === 'md' ? '📝' : '📎'}</span>
                <span className="truncate">{node.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ZONE CENTRALE (ÉDITEUR) */}
        <div className="flex-1 bg-black flex flex-col relative overflow-hidden">
          {currentTab === 'COCKPIT' ? (
            activeFile && activeFile.endsWith('.md') ? (
              <>
                <div className="h-12 border-b border-gray-900 flex items-center justify-between px-6 bg-gray-950/50">
                  <span className="font-mono text-sm text-gray-200 truncate max-w-md">{activeFile}</span>
                  <div className="flex items-center gap-2">
                    {isDirty && <span className="text-yellow-600 text-[10px] font-bold uppercase mr-3">Unsaved</span>}
                    <button onClick={handleSave} className="text-xs bg-blue-600 text-white px-4 py-1.5 rounded hover:bg-blue-500 font-bold">SAVE</button>
                  </div>
                </div>

                <div className="flex-1 overflow-auto p-6 max-w-4xl mx-auto w-full flex flex-col gap-6">

                  {/* TABLEAU D'ACTIONS */}
                  <div className="bg-gray-900/30 border border-gray-800 rounded-lg overflow-hidden flex flex-col max-h-[40vh]">
                    <div className="bg-gray-900 px-4 py-2 border-b border-gray-800 flex justify-between items-center shrink-0">
                      <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider">⚡ Action Plan</h3>
                      <button onClick={() => addAction()} className="text-[10px] bg-blue-900/30 hover:bg-blue-900/50 text-blue-300 px-2 py-1 rounded border border-blue-900/50">+ TASK</button>
                    </div>
                    <div className="flex gap-2 px-2 py-1 bg-gray-900/50 text-[10px] text-gray-500 uppercase tracking-wider font-bold shrink-0">
                      <div className="w-6 text-center"></div>
                      <div className="w-10 text-center">ID</div>
                      <div className="flex-1">Action</div>
                      <div className="w-20">Pilot</div>
                      <div className="w-24 text-center">Deadline</div>
                      <div className="w-6"></div>
                      <div className="w-6"></div>
                    </div>
                    <div className="p-2 overflow-y-auto flex-1">
                      {localActions.map((action) => {
                        // CALCUL INDENTATION POUR SOUS-TACHES
                        const depth = action.code.split('.').length - 1;
                        const marginLeft = depth * 20;

                        return (
                          <div key={action.id} style={{ marginLeft: `${marginLeft}px` }} className="flex items-center gap-2 bg-black/40 p-1.5 rounded border border-gray-800/50 group hover:border-blue-900/50 transition-colors">
                            <input type="checkbox" checked={action.status} onChange={(e) => updateAction(action.id, 'status', e.target.checked)} className="w-4 h-4 cursor-pointer accent-blue-500 shrink-0" />
                            <input type="text" value={action.code} onChange={(e) => updateAction(action.id, 'code', e.target.value)} className="w-10 bg-gray-800 border-none text-xs text-center text-blue-300 rounded focus:bg-gray-700 font-mono" />
                            <input type="text" value={action.task} onChange={(e) => updateAction(action.id, 'task', e.target.value)} className={`flex-1 bg-transparent border-none text-sm focus:outline-none ${action.status ? 'text-gray-500 line-through' : 'text-gray-200'}`} placeholder="Action..." />
                            <input type="text" value={action.owner} onChange={(e) => updateAction(action.id, 'owner', e.target.value)} className="w-20 bg-gray-900/50 border border-gray-800 text-xs text-center text-gray-400 rounded focus:text-blue-300 focus:border-blue-800" placeholder="Owner" />
                            <input type="date" value={action.deadline} onChange={(e) => updateAction(action.id, 'deadline', e.target.value)} className="w-24 bg-gray-900/50 border border-gray-800 text-xs text-center text-gray-400 rounded focus:text-yellow-500 focus:border-yellow-800" />
                            <button onClick={() => addAction(action.code)} className="text-[9px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded hover:bg-gray-700 hover:text-white" title="Sub-task">↪</button>
                            <button onClick={() => removeAction(action.id)} className="text-gray-700 hover:text-red-500 px-1 opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* TEXT EDITOR */}
                  <div className="flex-1 min-h-[400px] border-t border-gray-900 pt-4">
                    <textarea className="w-full h-full bg-black text-gray-300 font-mono text-base resize-none focus:outline-none leading-relaxed" value={bodyContent} onChange={(e) => { setBodyContent(e.target.value); setIsDirty(true); }} spellCheck={false} placeholder="Write your note here..." />
                  </div>
                </div>
              </>
            ) : (<div className="h-full flex flex-col items-center justify-center text-gray-800 select-none"><div className="text-6xl mb-4 opacity-10">◈</div><p className="text-xs mt-4">Select a .md file to edit</p></div>)
          ) : (
            // --- MASTER PLAN ---
            <div className="flex flex-col h-full bg-gray-950/50">
              <div className="h-16 border-b border-gray-900 flex items-center px-8 bg-black">
                <h2 className="text-xl font-bold text-white tracking-widest flex items-center gap-3"><span className="text-purple-500">◈</span> GLOBAL MASTER PLAN</h2>
                <div className="ml-auto text-xs text-gray-500">{globalActions.length} actions loaded</div>
              </div>
              <div className="flex-1 overflow-auto p-8">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
                      <th className="pb-3 pl-2 w-10">Sts</th>
                      <th className="pb-3 w-16">ID</th>
                      <th className="pb-3">Action</th>
                      <th className="pb-3 w-40">Source</th>
                      <th className="pb-3 w-24">Pilot</th>
                      <th className="pb-3 w-32 text-right">Deadline</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm text-gray-300 font-mono">
                    {globalActions.map((action) => (
                      <tr key={action.id} className="border-b border-gray-900 hover:bg-gray-900/50 transition-colors group">
                        <td className="py-3 pl-2"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${action.status === 'DONE' ? 'bg-green-900/30 text-green-500' : 'bg-red-900/30 text-red-500'}`}>{action.status === 'DONE' ? 'OK' : '..'}</span></td>
                        <td className="py-3 text-blue-500 font-bold">{action.code}</td>
                        <td className={`py-3 ${action.status === 'DONE' ? 'line-through opacity-50' : 'text-white'}`}>{action.task}</td>
                        <td className="py-3 text-gray-500 text-xs truncate max-w-[200px] cursor-pointer hover:text-white hover:underline" onClick={() => { setActiveFile(action.note_path || ""); setCurrentTab('COCKPIT'); }}>
                          {action.note_path} {/* Chemin complet affiché */}
                        </td>
                        <td className="py-3 text-blue-300">{action.owner}</td>
                        <td className="py-3 text-right text-yellow-600">{action.deadline}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* SIDEBAR DROITE (CONTEXT PILOT) - RETOUR */}
        {currentTab === 'COCKPIT' && (
          <div className="w-80 bg-gray-950 border-l border-gray-900 flex flex-col p-6 gap-6 overflow-y-auto transition-all">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-900 pb-2">Context Pilot</h3>
            {activeFile ? (
              <>
                {/* ZONE METADATA */}
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] text-gray-600 font-bold uppercase mb-2 block">Project Status</label>
                    <select value={metadata.status} onChange={(e) => { setMetadata({ ...metadata, status: e.target.value }); setIsDirty(true); }} className="w-full bg-gray-900 border border-gray-800 text-gray-300 text-xs rounded p-2 focus:border-blue-500 focus:outline-none"> <option value="ACTIVE">🟢 ACTIVE</option> <option value="HOLD">🟠 ON HOLD</option> <option value="DONE">🔵 COMPLETED</option> <option value="ARCHIVED">⚫ ARCHIVED</option> </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-600 font-bold uppercase mb-2 block">Entry Type</label>
                    <div className="flex gap-2"> {['NOTE', 'PROJECT', 'TASK'].map(type => (<button key={type} onClick={() => { setMetadata({ ...metadata, type }); setIsDirty(true); }} className={`flex-1 py-2 text-[10px] font-bold rounded border ${metadata.type === type ? "bg-blue-900/30 border-blue-800 text-blue-400" : "bg-gray-900 border-gray-800 text-gray-500 hover:bg-gray-800"}`}>{type}</button>))} </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-600 font-bold uppercase mb-2 block">Tags</label>
                    <input type="text" value={metadata.tags} onChange={(e) => { setMetadata({ ...metadata, tags: e.target.value }); setIsDirty(true); }} className="w-full bg-gray-900 border border-gray-800 text-gray-300 text-xs rounded p-2 focus:border-blue-500 focus:outline-none font-mono" placeholder="tag1, tag2" />
                  </div>
                </div>

                {/* ZONE INTELLIGENCE ASSOCIATIVE */}
                <div className="mt-6 pt-6 border-t border-gray-900">
                  <h4 className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-3 flex items-center gap-2">Related Work <span className="bg-blue-900/30 text-blue-400 px-1.5 rounded-full text-[9px]">{relatedNotes.length}</span></h4>
                  <ul className="space-y-2"> {relatedNotes.map(note => (<li key={note.id} onClick={() => { setActiveFile(note.path); parseFullFile("", note.path); }} className="group cursor-pointer bg-gray-900/30 border border-gray-900 hover:border-blue-800 hover:bg-gray-900 p-2 rounded transition-all"> <div className="flex items-center gap-2 mb-1"> <span className="text-[10px] opacity-50">doc</span> <span className="text-xs text-gray-300 group-hover:text-white truncate font-medium">{note.path.replace('.md', '')}</span> </div> <div className="flex gap-1 flex-wrap"> {note.tags?.split(',').map(t => (<span key={t} className="text-[9px] text-gray-600 bg-black px-1 rounded">{t}</span>))} </div> </li>))} </ul>
                </div>
              </>
            ) : (<div className="text-center text-gray-700 text-xs mt-10">No context available.</div>)}
          </div>
        )}

      </div>
    </div>
  );
}

export default App;