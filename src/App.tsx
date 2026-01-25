import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import Database from "@tauri-apps/plugin-sql";
import { LazyStore } from "@tauri-apps/plugin-store";
import { DragEndEvent } from "@dnd-kit/core";
import WelcomeView from "./WelcomeView";
import Sidebar, { FileNode } from "./Sidebar";

// --- CONSTANTES ---
const METADATA_SEPARATOR = "--- AEGIS METADATA ---";
const ACTION_HEADER_MARKER = "## PLAN D'ACTION"; // Version assouplie sans sauts de ligne stricts
const STORE_PATH = "aegis_config.json";

// --- TYPES ---
interface NoteMetadata { type: string; status: string; tags: string; }
interface ActionItem {
  id: string; code: string; status: boolean; created: string; deadline: string;
  owner: string; task: string; note_path?: string; collapsed?: boolean;
}
interface Note { id: string; path: string; tags?: string; }

// --- UTILITAIRES ---
function generateSimpleId() { return crypto.randomUUID(); }
function getTodayDate() { return new Date().toISOString().split('T')[0]; }

function App() {
  // --- STATE SYSTEME ---
  const [vaultPath, setVaultPath] = useState<string | null>(null);
  const [isStoreLoaded, setIsStoreLoaded] = useState(false);
  const [status, setStatus] = useState<string>("BOOTING...");
  const [db, setDb] = useState<Database | null>(null);
  const [syncStatus, setSyncStatus] = useState<string>("");

  // --- STATE UI ---
  const [currentTab, setCurrentTab] = useState<'COCKPIT' | 'MASTER_PLAN'>('COCKPIT');
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [activeFile, setActiveFile] = useState<string>("");
  const [selectedFolder, setSelectedFolder] = useState<string>("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [isDirty, setIsDirty] = useState(false);

  // --- STATE DONNEES (CONTENU) ---
  const [bodyContent, setBodyContent] = useState<string>("");
  const [localActions, setLocalActions] = useState<ActionItem[]>([]);
  const [globalActions, setGlobalActions] = useState<ActionItem[]>([]);
  const [metadata, setMetadata] = useState<NoteMetadata>({ type: "NOTE", status: "ACTIVE", tags: "" });
  const [relatedNotes, setRelatedNotes] = useState<Note[]>([]);

  // --- INIT ---
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const store = new LazyStore(STORE_PATH);
        const path = await store.get<string>("vault_path");
        if (path) setVaultPath(path);
      } catch (e) { console.error(e); } finally { setIsStoreLoaded(true); }
    }; loadConfig();
  }, []);

  useEffect(() => {
    if (!vaultPath) return;
    const init = async () => {
      try {
        const sysMsg = await invoke<string>("check_system_status");
        const database = await Database.load("sqlite:aegis_v4.db");
        setDb(database); setStatus(`${sysMsg}`); handleScan(database);
      } catch (err) { setStatus("SYSTEM FAILURE"); }
    }; init();
  }, [vaultPath]);

  // --- LOGIQUE METIER (PARSING ROBUSTE) ---
  const sortActionsSemantic = (actions: ActionItem[]) => {
    return [...actions].sort((a, b) => {
      if (a.note_path && b.note_path && a.note_path !== b.note_path) return a.note_path!.localeCompare(b.note_path!);
      const partsA = a.code.split('.').map(n => parseInt(n, 10));
      const partsB = b.code.split('.').map(n => parseInt(n, 10));
      const len = Math.max(partsA.length, partsB.length);
      for (let i = 0; i < len; i++) {
        const valA = partsA[i] !== undefined ? partsA[i] : -1;
        const valB = partsB[i] !== undefined ? partsB[i] : -1;
        if (valA === -1) return -1; if (valB === -1) return 1;
        if (valA !== valB) return valA - valB;
      }
      return 0;
    });
  };

  const parseFullFile = (rawText: string, filePath: string) => {
    // 1. NORMALISATION : On convertit tous les retours chariot Windows (\r\n) en Unix (\n)
    let text = rawText.replace(/\r\n/g, "\n");

    let meta = { type: "NOTE", status: "ACTIVE", tags: "" };
    let actions: ActionItem[] = [];
    const seenCodes = new Set<string>();

    // 2. EXTRACTION METADATA
    if (text.includes(METADATA_SEPARATOR)) {
      const parts = text.split(METADATA_SEPARATOR);
      text = parts[0]; // On garde le corps
      const metaBlock = parts[1];
      if (metaBlock) {
        metaBlock.split("\n").forEach(line => {
          if (line.startsWith("TYPE:")) meta.type = line.replace("TYPE:", "").trim();
          if (line.startsWith("STATUS:")) meta.status = line.replace("STATUS:", "").trim();
          if (line.startsWith("TAGS:")) meta.tags = line.replace("TAGS:", "").trim();
        });
      }
    }

    // 3. EXTRACTION ACTIONS (Avec le nouveau marqueur souple)
    if (text.includes(ACTION_HEADER_MARKER)) {
      const parts = text.split(ACTION_HEADER_MARKER);
      text = parts[0]; // On garde le texte avant le header

      const actionBlock = parts[1];
      if (actionBlock) {
        actionBlock.split("\n").forEach(line => {
          if (line.trim().startsWith("|") && !line.includes("---") && !line.includes("| ID |")) {
            const cols = line.split("|").map(c => c.trim());
            if (cols.length >= 7) {
              const code = cols[1] || "";
              if (code && !seenCodes.has(code)) {
                seenCodes.add(code);
                actions.push({
                  id: generateSimpleId(),
                  code: code,
                  status: cols[2].toLowerCase().includes("x"),
                  created: cols[3],
                  deadline: cols[4],
                  owner: cols[5],
                  task: cols[6],
                  note_path: filePath,
                  collapsed: false
                });
              }
            }
          }
        });
      }
    }

    setBodyContent(text.trim());
    setMetadata(meta);
    setLocalActions(sortActionsSemantic(actions));

    if (db) findRelatedNotes(filePath, meta.tags, db);
  };

  const constructFullFile = (content: string, actions: ActionItem[], meta: NoteMetadata) => {
    let file = content + "\n\n";
    if (actions.length > 0) {
      const sortedActions = sortActionsSemantic(actions);
      file += `${ACTION_HEADER_MARKER}\n`;
      file += "| ID | Etat | Créé le | Deadline | Pilote | Action |\n";
      file += "| :--- | :---: | :--- | :--- | :--- | :--- |\n";
      sortedActions.forEach(a => { file += `| ${a.code} | [${a.status ? 'x' : ' '}] | ${a.created} | ${a.deadline} | ${a.owner} | ${a.task} |\n`; });
    }
    file += `\n\n${METADATA_SEPARATOR}\n`;
    file += `TYPE: ${meta.type}\nSTATUS: ${meta.status}\nTAGS: ${meta.tags}`;
    return file;
  };

  // --- ACTIONS BASE DE DONNEES ---
  const handleScan = async (databaseInstance?: Database) => {
    const database = databaseInstance || db; if (!database) return; setSyncStatus("SYNCING...");
    try {
      const nodes = await invoke<FileNode[]>("scan_vault_recursive", { root: vaultPath });
      setFileTree(nodes.sort((a, b) => a.path.localeCompare(b.path)));

      // REGENERATION DB
      await database.execute("DELETE FROM actions");
      for (const node of nodes) {
        if (node.is_dir || node.extension !== "md") continue;

        // NORMALISATION POUR SCAN
        const cleanContent = node.content.replace(/\r\n/g, "\n");
        let bodyForDb = cleanContent;
        let type = "NOTE", status = "ACTIVE", tags = "";

        if (cleanContent.includes(METADATA_SEPARATOR)) {
          const parts = cleanContent.split(METADATA_SEPARATOR);
          bodyForDb = parts[0];
          const m = parts[1];
          if (m) {
            if (m.includes("TYPE:")) type = m.split("TYPE:")[1].split("\n")[0].trim();
            if (m.includes("STATUS:")) status = m.split("STATUS:")[1].split("\n")[0].trim();
            if (m.includes("TAGS:")) tags = m.split("TAGS:")[1].split("\n")[0].trim();
          }
        }

        const exists = await database.select<any[]>("SELECT id FROM notes WHERE path = $1", [node.path]);
        if (exists.length === 0) await database.execute("INSERT INTO notes (id, path, last_synced, content, type, status, tags) VALUES ($1, $2, $3, $4, $5, $6, $7)", [generateSimpleId(), node.path, Date.now(), bodyForDb, type, status, tags]);
        else await database.execute("UPDATE notes SET last_synced=$1, content=$2, type=$3, status=$4, tags=$5 WHERE path=$6", [Date.now(), bodyForDb, type, status, tags, node.path]);

        const seenCodesInFile = new Set<string>();
        if (cleanContent.includes(ACTION_HEADER_MARKER)) {
          const parts = cleanContent.split(ACTION_HEADER_MARKER);
          if (parts[1]) {
            parts[1].split("\n").forEach(async (line) => {
              if (line.trim().startsWith("|") && !line.includes("---") && !line.includes("| ID |")) {
                const c = line.split("|").map(x => x.trim());
                if (c.length >= 7) {
                  const code = c[1];
                  if (code && !seenCodesInFile.has(code)) {
                    seenCodesInFile.add(code);
                    await database.execute("INSERT INTO actions (id, note_path, code, status, task, owner, created_at, deadline, comment) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)", [generateSimpleId(), node.path, code, c[2].includes("x") ? 'DONE' : 'TODO', c[6], c[5], c[3], c[4], ""]);
                  }
                }
              }
            });
          }
        }
      }
      setSyncStatus(`READY`);
      // CHARGEMENT MASTER PLAN
      const allActionsRaw = await database.select<any[]>("SELECT * FROM actions");
      const allActionsTyped = allActionsRaw.map(a => ({ ...a, status: a.status === 'DONE', collapsed: false }));
      setGlobalActions(sortActionsSemantic(allActionsTyped));
    } catch (error) { console.error(error); setSyncStatus("SYNC ERROR"); }
  };

  const findRelatedNotes = async (currentFile: string, tags: string, database: Database) => { if (!tags) { setRelatedNotes([]); return; } const tagList = tags.split(/[;,]/).map(t => t.trim()).filter(t => t.length > 0); if (tagList.length === 0) { setRelatedNotes([]); return; } let sql = "SELECT id, path, tags FROM notes WHERE path != $1 AND ("; const params: any[] = [currentFile]; tagList.forEach((tag, index) => { if (index > 0) sql += " OR "; sql += `tags LIKE $${index + 2}`; params.push(`%${tag}%`); }); sql += ") ORDER BY last_synced DESC LIMIT 5"; try { const results = await database.select<Note[]>(sql, params); setRelatedNotes(results); } catch (err) { console.error(err); } };

  // --- EVENTS UTILISATEUR ---
  const handleVaultSelection = async (path: string) => { const store = new LazyStore(STORE_PATH); await store.set("vault_path", path); await store.save(); setVaultPath(path); };
  const handleCloseVault = async () => { if (!confirm("Fermer le Cockpit ?")) return; const store = new LazyStore(STORE_PATH); await store.set("vault_path", null); await store.save(); setVaultPath(null); };

  const handleCreateNote = async () => {
    try {
      const targetFolder = selectedFolder || "01_Inbox";
      const baseName = "Untitled"; let finalName = `${baseName}.md`; let counter = 1;
      while (fileTree.some(n => n.path === `${targetFolder}/${finalName}`)) { finalName = `${baseName} ${counter}.md`; counter++; }
      const fullPath = `${vaultPath}\\${targetFolder}\\${finalName}`.replace(/\//g, '\\');
      const template = `# ${finalName.replace('.md', '')}\n\nCreated: ${new Date().toLocaleString()}\n\n`;
      if (targetFolder === "01_Inbox") await invoke("create_folder", { path: `${vaultPath}\\01_Inbox` });
      await invoke("create_note", { path: fullPath, content: template });
      await handleScan(); setActiveFile(`${targetFolder}/${finalName}`); setSelectedFolder(targetFolder); setBodyContent(template); setCurrentTab('COCKPIT');
    } catch (e) { alert("Erreur: " + e); }
  };
  const handleCreateFolder = async () => { const name = prompt("Nom du dossier :"); if (!name) return; const p = selectedFolder ? `${selectedFolder}/` : ""; await invoke("create_folder", { path: `${vaultPath}\\${p}${name}` }); await handleScan(); };
  const handleDeleteFolder = async () => { if (confirm("Supprimer ce dossier ?")) { await invoke("delete_folder", { path: `${vaultPath}\\${selectedFolder}` }); setSelectedFolder(""); await handleScan(); } };
  const handleDeleteFile = async () => { if (confirm("Supprimer ?")) { await invoke("delete_note", { path: `${vaultPath}\\${activeFile}` }); setActiveFile(""); await handleScan(); } };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event; if (!over || active.id === over.id) return;
    try {
      const fullSource = `${vaultPath}\\${(active.id as string).replace(/\//g, '\\')}`;
      const fullDest = `${vaultPath}\\${(over.id as string).replace(/\//g, '\\')}`;
      await invoke("move_file_system_entry", { sourcePath: fullSource, destinationFolder: fullDest });
      await handleScan();
    } catch (e) { alert("Move Error: " + e); }
  };

  const toggleFolderExpand = (path: string) => { const next = new Set(expandedFolders); if (next.has(path)) next.delete(path); else next.add(path); setExpandedFolders(next); };

  const handleNodeClick = async (node: FileNode) => {
    if (node.is_dir) { setSelectedFolder(node.path === selectedFolder ? "" : node.path); setActiveFile(""); }
    else {
      setActiveFile(node.path); setSelectedFolder(node.path.split('/').slice(0, -1).join('/'));
      const content = await invoke<string>("read_note", { path: `${vaultPath}\\${node.path}` });
      parseFullFile(content, node.path);
      setIsDirty(false); setCurrentTab('COCKPIT');
    }
  };
  const handleSave = async () => { if (activeFile) { const fullPath = `${vaultPath}\\${activeFile.replace(/\//g, '\\')}`; const finalContent = constructFullFile(bodyContent, localActions, metadata); await invoke("save_note", { path: fullPath, content: finalContent }); await handleScan(); setIsDirty(false); } };

  // --- ACTION PLAN MANAGEMENT ---
  const addAction = (parentId?: string) => {
    let newCode = "";
    if (parentId) {
      const siblings = localActions.filter(a => a.code.startsWith(parentId + ".") && a.code.split('.').length === parentId.split('.').length + 1);
      let maxSuffix = 0; siblings.forEach(s => { const parts = s.code.split('.'); const suffix = parseInt(parts[parts.length - 1] || "0"); if (suffix > maxSuffix) maxSuffix = suffix; }); newCode = `${parentId}.${maxSuffix + 1}`;
      setLocalActions(prev => prev.map(a => a.code === parentId ? { ...a, collapsed: false } : a));
    } else {
      const roots = localActions.filter(a => !a.code.includes("."));
      let maxRoot = 0; roots.forEach(r => { const val = parseInt(r.code); if (val > maxRoot) maxRoot = val; }); newCode = (maxRoot + 1).toString();
    }
    const newItem = { id: generateSimpleId(), code: newCode, status: false, created: getTodayDate(), deadline: "", owner: "", task: "", collapsed: false, note_path: activeFile };
    setLocalActions(prev => sortActionsSemantic([...prev, newItem])); setIsDirty(true);
  };
  const updateAction = (id: string, field: keyof ActionItem, value: any) => { setLocalActions(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a)); setIsDirty(true); };
  const removeAction = (id: string, code: string) => { setLocalActions(prev => prev.filter(a => a.id !== id && !a.code.startsWith(code + "."))); setIsDirty(true); };
  const toggleLocalCollapse = (code: string) => { setLocalActions(prev => prev.map(a => a.code === code ? { ...a, collapsed: !a.collapsed } : a)); };
  const isVisibleInCockpit = (action: ActionItem, list: ActionItem[]) => {
    if (!action.code.includes('.')) return true;
    const parts = action.code.split('.'); let currentCode = parts[0];
    for (let i = 0; i < parts.length - 1; i++) { const parent = list.find(a => a.code === currentCode); if (parent && parent.collapsed) return false; currentCode += `.${parts[i + 1]}`; } return true;
  };

  // --- MASTER PLAN HELPERS ---
  const isVisibleInMaster = (action: ActionItem, list: ActionItem[]) => {
    if (!action.code.includes('.')) return true;
    const parts = action.code.split('.'); let currentCode = parts[0];
    for (let i = 0; i < parts.length - 1; i++) { const parent = list.find(a => a.note_path === action.note_path && a.code === currentCode); if (parent && parent.collapsed) return false; currentCode += `.${parts[i + 1]}`; } return true;
  };
  const toggleGlobalCollapse = (notePath: string, code: string) => { setGlobalActions(prev => prev.map(a => (a.note_path === notePath && a.code === code) ? { ...a, collapsed: !a.collapsed } : a)); };
  const openNote = async (notePath: string) => {
    if (!notePath) return; try { const fullPath = `${vaultPath}\\${notePath.replace(/\//g, '\\')}`; const content = await invoke<string>("read_note", { path: fullPath }); setActiveFile(notePath); const folder = notePath.includes('/') ? notePath.substring(0, notePath.lastIndexOf('/')) : ""; setSelectedFolder(folder); parseFullFile(content, notePath); setIsDirty(false); setCurrentTab('COCKPIT'); } catch (e) { alert("Erreur ouverture: " + e); }
  };
  const toggleActionFromMaster = async (action: ActionItem) => {
    if (!action.note_path) return;
    try {
      const fullPath = `${vaultPath}\\${action.note_path.replace(/\//g, '\\')}`;
      const content = await invoke<string>("read_note", { path: fullPath });
      // Parsing Rapide Normalisé
      const clean = content.replace(/\r\n/g, "\n");
      let fileBody = clean; let fileMeta = { type: "NOTE", status: "ACTIVE", tags: "" }; let fileActions: ActionItem[] = [];
      if (clean.includes(METADATA_SEPARATOR)) { const parts = clean.split(METADATA_SEPARATOR); fileBody = parts[0]; const m = parts[1]; if (m && m.includes("TYPE:")) fileMeta.type = m.split("TYPE:")[1].split("\n")[0].trim(); if (m && m.includes("STATUS:")) fileMeta.status = m.split("STATUS:")[1].split("\n")[0].trim(); if (m && m.includes("TAGS:")) fileMeta.tags = m.split("TAGS:")[1].split("\n")[0].trim(); }
      if (clean.includes(ACTION_HEADER_MARKER)) { const parts = clean.split(ACTION_HEADER_MARKER); fileBody = parts[0]; if (parts[1]) parts[1].split("\n").forEach(l => { if (l.trim().startsWith("|") && !l.includes("---") && !l.includes("ID")) { const c = l.split("|").map(x => x.trim()); if (c.length >= 7) fileActions.push({ id: generateSimpleId(), code: c[1], status: c[2].includes("x"), created: c[3], deadline: c[4], owner: c[5], task: c[6], note_path: action.note_path }); } }); }

      const target = fileActions.find(a => a.code === action.code); if (target) target.status = !target.status;
      const newContent = constructFullFile(fileBody.trim(), fileActions, fileMeta);
      await invoke("save_note", { path: fullPath, content: newContent });
      setGlobalActions(prev => prev.map(a => (a.note_path === action.note_path && a.code === action.code) ? { ...a, status: !a.status } : a));
      if (db) await db.execute("UPDATE actions SET status = $1 WHERE note_path = $2 AND code = $3", [target?.status ? 'DONE' : 'TODO', action.note_path, action.code]);
    } catch (err) { alert("Erreur Master: " + err); }
  };

  // --- RENDU ---
  if (!isStoreLoaded) return <div className="bg-black h-screen text-white flex items-center justify-center">LOADING...</div>;
  if (!vaultPath) return <WelcomeView onVaultSelected={handleVaultSelection} />;

  return (
    <div className="h-screen w-screen bg-black text-white flex flex-col overflow-hidden font-sans">
      <div className="h-10 bg-gray-950 border-b border-gray-900 flex items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <span className="text-gray-500 text-xs font-bold tracking-widest uppercase flex gap-2 items-center"><div className={`w-2 h-2 rounded-full ${status.includes("FAILURE") ? 'bg-red-500' : 'bg-green-500'}`}></div>AEGIS V4.2</span>
          <div className="flex gap-1 bg-gray-900 p-1 rounded">
            <button onClick={() => setCurrentTab('COCKPIT')} className={`px-4 py-1 text-xs font-bold rounded ${currentTab === 'COCKPIT' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}>COCKPIT</button>
            <button onClick={() => { setCurrentTab('MASTER_PLAN'); handleScan(); }} className={`px-4 py-1 text-xs font-bold rounded ${currentTab === 'MASTER_PLAN' ? 'bg-purple-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}>MASTER PLAN</button>
          </div>
        </div>
        <div className="text-[10px] text-gray-600">{syncStatus}</div>
      </div>

      <div className="flex flex-1 min-h-0">
        <Sidebar
          fileTree={fileTree} activeFile={activeFile} selectedFolder={selectedFolder} expandedFolders={expandedFolders}
          onToggleExpand={toggleFolderExpand} onNodeClick={handleNodeClick} onDragEnd={handleDragEnd}
          onCreateFolder={handleCreateFolder} onCreateNote={handleCreateNote} onDeleteFolder={handleDeleteFolder} onCloseVault={handleCloseVault}
        />

        <div className="flex-1 bg-black flex flex-col relative overflow-hidden">
          {currentTab === 'COCKPIT' ? (
            activeFile ? (
              <>
                <div className="h-12 border-b border-gray-900 flex items-center justify-between px-6 bg-gray-950/50">
                  <span className="font-mono text-sm text-gray-200 truncate max-w-md">{activeFile}</span>
                  <div className="flex gap-2">
                    {isDirty && <span className="text-yellow-600 text-[10px] font-bold uppercase mr-3 self-center">Unsaved</span>}
                    <button onClick={handleSave} className="text-xs bg-blue-600 text-white px-4 py-1.5 rounded font-bold">SAVE</button>
                    <button onClick={handleDeleteFile} className="text-xs bg-red-900/20 text-red-400 px-3 py-1.5 rounded">TRASH</button>
                  </div>
                </div>
                <div className="flex-1 overflow-auto p-6 max-w-6xl mx-auto w-full flex flex-col gap-6">
                  {/* ACTION PANEL */}
                  <div className="bg-gray-900/30 border border-gray-800 rounded-lg overflow-hidden flex flex-col max-h-[40vh]">
                    <div className="bg-gray-900 px-4 py-2 border-b border-gray-800 flex justify-between items-center shrink-0">
                      <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider">⚡ Action Plan</h3>
                      <button onClick={() => addAction()} className="text-[10px] bg-blue-900/30 hover:bg-blue-900/50 text-blue-300 px-2 py-1 rounded border border-blue-900/50">+ TASK</button>
                    </div>
                    <div className="flex gap-2 px-2 py-1 bg-gray-900/50 text-[10px] text-gray-500 uppercase tracking-wider font-bold shrink-0">
                      <div className="w-6 text-center"></div><div className="w-10 text-center">ID</div><div className="flex-1">Action</div><div className="w-20">Pilot</div><div className="w-24 text-center">Deadline</div><div className="w-6"></div><div className="w-6"></div>
                    </div>
                    <div className="p-2 overflow-y-auto flex-1">
                      {localActions.map((action) => {
                        if (!isVisibleInCockpit(action, localActions)) return null;
                        const depth = action.code.split('.').length - 1;
                        const hasChildren = localActions.some(a => a.code.startsWith(action.code + "."));
                        return (
                          <div key={action.id} style={{ marginLeft: `${depth * 24}px` }} className="flex items-center gap-2 bg-black/40 p-1.5 rounded border border-gray-800/50 group hover:border-blue-900/50 transition-colors mb-1">
                            {hasChildren ? (<button onClick={() => toggleLocalCollapse(action.code)} className="text-gray-500 w-4 text-[10px] hover:text-white font-mono border border-gray-700 rounded bg-gray-900 h-4 flex items-center justify-center">{action.collapsed ? '+' : '-'}</button>) : <div className="w-4"></div>}
                            <input type="checkbox" checked={action.status} onChange={(e) => updateAction(action.id, 'status', e.target.checked)} className="w-4 h-4 cursor-pointer accent-blue-500 shrink-0" />
                            <input type="text" value={action.code} onChange={(e) => updateAction(action.id, 'code', e.target.value)} className="w-10 bg-gray-800 border-none text-xs text-center text-blue-300 rounded focus:bg-gray-700 font-mono" />
                            <input type="text" value={action.task} onChange={(e) => updateAction(action.id, 'task', e.target.value)} className={`flex-1 bg-transparent border-none text-sm focus:outline-none ${action.status ? 'text-gray-500 line-through' : 'text-gray-200'}`} placeholder="Action..." />
                            <input type="text" value={action.owner} onChange={(e) => updateAction(action.id, 'owner', e.target.value)} className="w-20 bg-gray-900/50 border border-gray-800 text-xs text-center text-gray-400 rounded focus:text-blue-300 focus:border-blue-800" placeholder="Owner" />
                            <input type="date" value={action.deadline} onChange={(e) => updateAction(action.id, 'deadline', e.target.value)} className="w-24 bg-gray-900/50 border border-gray-800 text-xs text-center text-gray-400 rounded focus:text-yellow-500 focus:border-yellow-800" />
                            <button onClick={() => addAction(action.code)} className="text-[9px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded hover:bg-gray-700 hover:text-white" title="Sub-task">↪</button>
                            <button onClick={() => removeAction(action.id, action.code)} className="text-gray-700 hover:text-red-500 px-1 opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {/* EDITOR */}
                  <div className="flex-1 min-h-[400px] border-t border-gray-900 pt-4">
                    <textarea className="w-full h-full bg-black text-gray-300 font-mono text-base resize-none focus:outline-none leading-relaxed" value={bodyContent} onChange={(e) => { setBodyContent(e.target.value); setIsDirty(true); }} spellCheck={false} placeholder="Write your note here..." />
                  </div>
                </div>
              </>
            ) : <div className="h-full flex items-center justify-center text-gray-800">NO FILE SELECTED</div>
          ) : (
            // --- MASTER PLAN VIEW ---
            <div className="flex flex-col h-full bg-gray-950/50">
              <div className="h-16 border-b border-gray-900 flex items-center px-8 bg-black">
                <h2 className="text-xl font-bold text-white tracking-widest flex items-center gap-3"><span className="text-purple-500">◈</span> GLOBAL MASTER PLAN</h2>
                <div className="ml-auto text-xs text-gray-500">{globalActions.length} actions loaded</div>
              </div>
              <div className="flex-1 overflow-auto p-8">
                <div className="flex bg-gray-900 px-4 py-2 border-b border-gray-800 flex justify-between items-center shrink-0">
                  <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wider">⚡ Global Aggregation</h3>
                </div>
                <div className="flex gap-2 px-4 py-2 bg-gray-900/50 text-[10px] text-gray-500 uppercase tracking-wider font-bold shrink-0 border-b border-gray-800 mb-2">
                  <div className="w-6 text-center"></div><div className="w-10 text-center">ID</div><div className="flex-1">Action</div><div className="w-20 text-center">Pilot</div><div className="w-24 text-center">Deadline</div><div className="w-24 text-center">Source</div>
                </div>
                <div className="p-4 overflow-y-auto flex-1">
                  {globalActions.map((action) => {
                    if (!isVisibleInMaster(action, globalActions)) return null;
                    const depth = action.code.split('.').length - 1;
                    const hasChildren = globalActions.some(a => a.note_path === action.note_path && a.code.startsWith(action.code + "."));
                    return (
                      <div key={action.id} style={{ marginLeft: `${depth * 24}px` }} className="flex items-center gap-2 bg-gray-900/20 p-1.5 rounded border border-gray-800/50 group hover:border-purple-500/30 hover:bg-gray-900/40 transition-all mb-1">
                        {hasChildren ? (<button onClick={() => toggleGlobalCollapse(action.note_path || "", action.code)} className="text-gray-500 w-4 text-[10px] hover:text-white font-mono border border-gray-700 rounded bg-gray-900 h-4 flex items-center justify-center">{action.collapsed ? '+' : '-'}</button>) : <div className="w-4"></div>}
                        <input type="checkbox" checked={action.status} onChange={() => toggleActionFromMaster(action)} className="w-4 h-4 cursor-pointer accent-purple-500 shrink-0" />
                        <div className="w-10 bg-gray-900/50 text-xs text-center text-blue-400 rounded font-mono py-1 border border-gray-800">{action.code}</div>
                        <div className={`flex-1 text-sm ${action.status ? 'text-gray-500 line-through' : 'text-gray-300'} truncate px-2`} title={action.task}>{action.task}</div>
                        <div className="w-20 bg-gray-900/50 border border-gray-800 text-xs text-center text-gray-500 rounded py-1">{action.owner || '-'}</div>
                        <div className="w-24 bg-gray-900/50 border border-gray-800 text-xs text-center text-yellow-700/70 rounded py-1">{action.deadline || '-'}</div>
                        <button onClick={() => openNote(action.note_path || "")} className="w-24 bg-gray-900/50 hover:bg-blue-900/30 border border-gray-800 hover:border-blue-700 text-[10px] text-gray-500 hover:text-blue-300 rounded py-1 truncate transition-colors text-center" title={`Open ${action.note_path}`}>
                          {action.note_path?.split('/').pop()?.replace('.md', '') || 'Unknown'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* METADATA SIDEBAR (PILOT) */}
        {currentTab === 'COCKPIT' && (
          <div className="w-80 bg-gray-950 border-l border-gray-900 flex flex-col p-6 gap-6 overflow-y-auto transition-all">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-900 pb-2">Context Pilot</h3>
            {activeFile ? (
              <>
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
                    <label className="text-[10px] text-gray-600 font-bold uppercase mb-2 block">Tags (; separated)</label>
                    <input type="text" value={metadata.tags} onChange={(e) => { setMetadata({ ...metadata, tags: e.target.value }); setIsDirty(true); }} className="w-full bg-gray-900 border border-gray-800 text-gray-300 text-xs rounded p-2 focus:border-blue-500 focus:outline-none font-mono" placeholder="tag1; tag2" />
                  </div>
                </div>
                <div className="mt-6 pt-6 border-t border-gray-900">
                  <h4 className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-3 flex items-center gap-2">Related Work <span className="bg-blue-900/30 text-blue-400 px-1.5 rounded-full text-[9px]">{relatedNotes.length}</span></h4>
                  <ul className="space-y-2"> {relatedNotes.map(note => (<li key={note.id} onClick={() => { setActiveFile(note.path); openNote(note.path); }} className="group cursor-pointer bg-gray-900/30 border border-gray-900 hover:border-blue-800 hover:bg-gray-900 p-2 rounded transition-all"> <div className="flex items-center gap-2 mb-1"> <span className="text-[10px] opacity-50">doc</span> <span className="text-xs text-gray-300 group-hover:text-white truncate font-medium">{note.path.replace('.md', '')}</span> </div> <div className="flex gap-1 flex-wrap"> {metadata.tags && metadata.tags.split(';').map(t => (<span key={t} className="text-[9px] text-gray-600 bg-black px-1 rounded">{t}</span>))} </div> </li>))} </ul>
                </div>
              </>
            ) : <div className="text-center text-gray-700 text-xs mt-10">No context available.</div>}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;