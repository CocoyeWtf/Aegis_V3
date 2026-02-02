import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { downloadDir, join } from '@tauri-apps/api/path';
import Database from "@tauri-apps/plugin-sql";
import { LazyStore } from "@tauri-apps/plugin-store";
import { DragEndEvent } from "@dnd-kit/core";
import * as XLSX from 'xlsx';
import WelcomeView from "./WelcomeView";
import Sidebar, { FileNode } from "./Sidebar";

// --- CONSTANTES ---
const METADATA_SEPARATOR = "--- AEGIS METADATA ---";
const ACTION_HEADER_MARKER = "## PLAN D'ACTION";
const STORE_PATH = "aegis_config.json";

interface NoteMetadata { id: string; type: string; status: string; tags: string; }
interface ActionItem { id: string; code: string; status: boolean; created: string; deadline: string; owner: string; task: string; comment: string; note_path?: string; collapsed?: boolean; }
interface Note { id: string; path: string; tags?: string; }

// V10.19 : TYPES EMAIL
interface EmailItem {
  id: string;
  subject: string;
  sender: string;
  received: string;
  body_preview: string;
  is_read: boolean;
}

function generateUUID() { return crypto.randomUUID(); }
function getTodayDate() { return new Date().toISOString().split('T')[0]; }
async function computeContentHash(text: string): Promise<string> { const msgBuffer = new TextEncoder().encode(text); const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer); const hashArray = Array.from(new Uint8Array(hashBuffer)); return hashArray.map(b => b.toString(16).padStart(2, '0')).join(''); }

const flattenNodes = (nodes: FileNode[]): FileNode[] => {
  let flat: FileNode[] = [];
  if (!nodes) return flat;
  for (const node of nodes) {
    flat.push(node);
    if (node.children && Array.isArray(node.children) && node.children.length > 0) {
      flat = flat.concat(flattenNodes(node.children));
    }
  }
  return flat;
};

function App() {
  const [vaultPath, setVaultPath] = useState<string | null>(null);
  const [isStoreLoaded, setIsStoreLoaded] = useState(false);
  const [status, setStatus] = useState<string>("BOOTING...");
  const [db, setDb] = useState<Database | null>(null);
  const [syncStatus, setSyncStatus] = useState<string>("");

  // TABS: COCKPIT | MASTER_PLAN | MAILBOX
  const [currentTab, setCurrentTab] = useState<'COCKPIT' | 'MASTER_PLAN' | 'MAILBOX'>('COCKPIT');

  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [activeFile, setActiveFile] = useState<string>("");
  const [activeExtension, setActiveExtension] = useState<string>("");
  const [selectedFolder, setSelectedFolder] = useState<string>("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [isDirty, setIsDirty] = useState(false);

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<FileNode[]>([]);

  // MAILBOX STATES
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("DISCONNECTED");
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<EmailItem | null>(null);

  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [rightSidebarWidth, setRightSidebarWidth] = useState(320);
  const [resizingTarget, setResizingTarget] = useState<'LEFT' | 'RIGHT' | null>(null);

  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<{ key: keyof ActionItem; direction: 'asc' | 'desc' } | null>(null);
  const [filterText, setFilterText] = useState<string>("");

  const [bodyContent, setBodyContent] = useState<string>("");
  const [localActions, setLocalActions] = useState<ActionItem[]>([]);
  const [globalActions, setGlobalActions] = useState<ActionItem[]>([]);
  const [metadata, setMetadata] = useState<NoteMetadata>({ id: "", type: "NOTE", status: "ACTIVE", tags: "" });

  const [relatedNotes, setRelatedNotes] = useState<Note[]>([]);
  const [detectedLinks, setDetectedLinks] = useState<string[]>([]);
  const [backlinks, setBacklinks] = useState<Note[]>([]);

  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { const load = async () => { try { const s = new LazyStore(STORE_PATH); const p = await s.get<string>("vault_path"); if (p) setVaultPath(p); } catch (e) { console.error(e); } finally { setIsStoreLoaded(true); } }; load(); }, []);
  useEffect(() => { if (!vaultPath) return; const init = async () => { try { const m = await invoke<string>("check_system_status"); const d = await Database.load("sqlite:aegis_v7.db"); setDb(d); setStatus(m); handleScan(d); } catch (e) { setStatus("FAIL"); } }; init(); }, [vaultPath]);

  const startResizingLeft = useCallback(() => setResizingTarget('LEFT'), []);
  const startResizingRight = useCallback(() => setResizingTarget('RIGHT'), []);
  const stopResizing = useCallback(() => setResizingTarget(null), []);
  const resize = useCallback((e: MouseEvent) => {
    if (resizingTarget === 'LEFT') { setSidebarWidth(Math.max(200, Math.min(800, e.clientX))); }
    else if (resizingTarget === 'RIGHT') { const newWidth = document.body.clientWidth - e.clientX; setRightSidebarWidth(Math.max(250, Math.min(800, newWidth))); }
  }, [resizingTarget]);
  useEffect(() => { window.addEventListener("mousemove", resize); window.addEventListener("mouseup", stopResizing); return () => { window.removeEventListener("mousemove", resize); window.removeEventListener("mouseup", stopResizing); }; }, [resize, stopResizing]);

  const handleVaultSelection = async (p: string) => { const s = new LazyStore(STORE_PATH); await s.set("vault_path", p); await s.save(); setVaultPath(p); };
  const handleCloseVault = async () => { if (!confirm("Fermer le Cockpit ?")) return; const s = new LazyStore(STORE_PATH); await s.set("vault_path", null); await s.save(); setVaultPath(null); };

  const handleGlobalSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query || query.length < 2) { setSearchResults([]); return; }
    if (!db) return;
    try {
      const results = await db.select<any[]>(`SELECT path FROM notes WHERE content LIKE $1 OR path LIKE $1 OR tags LIKE $1 LIMIT 50`, [`%${query}%`]);
      const nodes: FileNode[] = results.map(r => ({ name: r.path.split('/').pop() || r.path, path: r.path, is_dir: false, children: [], extension: 'md', content: '' }));
      setSearchResults(nodes);
    } catch (e) { console.error("Search error:", e); }
  };

  // MAILBOX FUNCTIONS (V10.19)
  const handleConnectOutlook = async () => {
    setConnectionStatus("TESTING NETWORK...");
    try {
      // Appel de la commande Rust de test
      const res = await invoke<string>("check_microsoft_connection");
      if (res === "CONNEXION_OK") {
        setConnectionStatus("ONLINE - WAITING AUTH");
        // Simulation pour l'instant : on peuple avec des faux mails
        setEmails([
          { id: "1", subject: "Compte rendu Réunion MEA", sender: "Dominic Verleyen", received: "10:30", body_preview: "Voici le CR de la réunion...", is_read: false },
          { id: "2", subject: "Validation Budget 2026", sender: "Michel", received: "Hier", body_preview: "Merci de valider le budget avant...", is_read: true },
        ]);
        setIsConnected(true);
      } else {
        setConnectionStatus("NETWORK ERROR: " + res);
      }
    } catch (e) {
      setConnectionStatus("FATAL ERROR: " + e);
    }
  };

  const handleExportExcel = async (actionsToExport: ActionItem[], filename: string) => {
    if (!actionsToExport || actionsToExport.length === 0) { alert("Rien à exporter."); return; }
    try {
      const data = actionsToExport.map(a => ({ WBS: a.code, Action: a.task, Statut: a.status ? "FAIT" : "A FAIRE", Pilote: a.owner, Deadline: a.deadline, Commentaire: a.comment, Source: a.note_path }));
      const ws = XLSX.utils.json_to_sheet(data);
      const rows: any[] = []; actionsToExport.forEach(a => { const level = a.code ? (a.code.split('.').length - 1) : 0; rows.push({ level: level, hidden: false }); });
      if (!ws['!rows']) ws['!rows'] = rows;
      ws['!cols'] = [{ wch: 10 }, { wch: 50 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 30 }, { wch: 20 }];
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Actions");
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const cleanName = (filename || "Export").replace(/[^a-z0-9]/gi, '_'); const finalName = `AEGIS_${cleanName}_${getTodayDate()}.xlsx`;
      const downloadDirPath = await downloadDir(); const fullPath = await join(downloadDirPath, finalName);
      await invoke("save_binary_file", { path: fullPath, content: Array.from(new Uint8Array(wbout)) });
      alert(`Fichier exporté dans vos Téléchargements :\n${finalName}`);
    } catch (e) { alert("Erreur Export : " + e); console.error(e); }
  };

  const sortActionsSemantic = (actions: ActionItem[]) => { return [...actions].sort((a, b) => { if (a.note_path && b.note_path && a.note_path !== b.note_path) return a.note_path!.localeCompare(b.note_path!); const partsA = a.code.split('.').map(n => parseInt(n, 10)); const partsB = b.code.split('.').map(n => parseInt(n, 10)); const len = Math.max(partsA.length, partsB.length); for (let i = 0; i < len; i++) { const valA = partsA[i] !== undefined ? partsA[i] : -1; const valB = partsB[i] !== undefined ? partsB[i] : -1; if (valA === -1) return -1; if (valB === -1) return 1; if (valA !== valB) return valA - valB; } return 0; }); };
  const parseFullFile = (raw: string, path: string) => { let txt = raw.replace(/\r\n/g, "\n"); let m = { id: "", type: "NOTE", status: "ACTIVE", tags: "" }; let acts: ActionItem[] = []; const codes = new Set<string>(); if (txt.includes(METADATA_SEPARATOR)) { const p = txt.split(METADATA_SEPARATOR); txt = p[0]; p[1].split("\n").forEach(l => { if (l.startsWith("ID:")) m.id = l.replace("ID:", "").trim(); if (l.startsWith("TYPE:")) m.type = l.replace("TYPE:", "").trim(); if (l.startsWith("STATUS:")) m.status = l.replace("STATUS:", "").trim(); if (l.startsWith("TAGS:")) m.tags = l.replace("TAGS:", "").trim(); }); } if (txt.includes(ACTION_HEADER_MARKER)) { const p = txt.split(ACTION_HEADER_MARKER); txt = p[0]; if (p[1]) p[1].split("\n").forEach(l => { if (l.trim().startsWith("|") && !l.includes("---") && !l.includes("ID")) { const c = l.split("|").map(x => x.trim()); if (c.length >= 7) { const code = c[1]; if (code && !codes.has(code)) { codes.add(code); acts.push({ id: generateUUID(), code: code, status: c[2].includes("x"), created: c[3], deadline: c[4], owner: c[5], task: c[6], comment: c[7] || "", note_path: path, collapsed: false }); } } } }); } const links: string[] = []; let match; const rgx = /\[\[(.*?)\]\]/g; while ((match = rgx.exec(txt)) !== null) links.push(match[1]); setBodyContent(txt.trim()); setMetadata(m); setLocalActions(sortActionsSemantic(acts)); setDetectedLinks(links); if (db) { findRelated(path, m.tags, db); findBacklinks(path, db); } };
  const handleContentChange = (nc: string) => { setBodyContent(nc); setIsDirty(true); const rx = /\[\[(.*?)\]\]/g; const l: string[] = []; let m; while ((m = rx.exec(nc)) !== null) l.push(m[1]); setDetectedLinks(l); };
  const constructFullFile = (c: string, a: ActionItem[], m: NoteMetadata) => { let f = c + "\n\n"; if (a.length > 0) { const s = sortActionsSemantic(a); f += `${ACTION_HEADER_MARKER}\n| ID | Etat | Créé le | Deadline | Pilote | Action | Commentaire |\n| :--- | :---: | :--- | :--- | :--- | :--- | :--- |\n`; s.forEach(i => { f += `| ${i.code} | [${i.status ? 'x' : ' '}] | ${i.created} | ${i.deadline} | ${i.owner} | ${i.task} | ${i.comment} |\n`; }); } f += `\n\n${METADATA_SEPARATOR}\nID: ${m.id || generateUUID()}\nTYPE: ${m.type}\nSTATUS: ${m.status}\nTAGS: ${m.tags}`; return f; };

  const handleScan = async (dbInst?: Database) => { const database = dbInst || db; if (!database) return; setSyncStatus("INDEXING..."); try { const treeNodes = await invoke<FileNode[]>("scan_vault_recursive", { root: vaultPath }); setFileTree(treeNodes.sort((a, b) => a.path.localeCompare(b.path))); const allFiles = flattenNodes(treeNodes); await database.execute("DROP TABLE IF EXISTS actions"); await database.execute("CREATE TABLE actions (id TEXT, note_path TEXT, code TEXT, status TEXT, task TEXT, owner TEXT, created TEXT, deadline TEXT, comment TEXT)"); for (const node of allFiles) { try { if (node.is_dir || !node.extension || node.extension.toLowerCase() !== "md") continue; let content = node.content.replace(/\r\n/g, "\n"); let fileId = ""; let type = "NOTE", status = "ACTIVE", tags = ""; if (content.includes(METADATA_SEPARATOR)) { const p = content.split(METADATA_SEPARATOR); const m = p[1]; if (m) { if (m.includes("ID:")) fileId = m.split("ID:")[1].split("\n")[0].trim(); if (m.includes("TYPE:")) type = m.split("TYPE:")[1].split("\n")[0].trim(); if (m.includes("STATUS:")) status = m.split("STATUS:")[1].split("\n")[0].trim(); if (m.includes("TAGS:")) tags = m.split("TAGS:")[1].split("\n")[0].trim(); } } if (fileId) { const c = await database.select<any[]>("SELECT path FROM notes WHERE id = $1 AND path != $2", [fileId, node.path]); if (c.length > 0) fileId = ""; } if (!fileId) { fileId = generateUUID(); if (content.includes(METADATA_SEPARATOR)) content = content.split(METADATA_SEPARATOR)[0].trim(); content += `\n\n${METADATA_SEPARATOR}\nID: ${fileId}\nTYPE: ${type}\nSTATUS: ${status}\nTAGS: ${tags}`; await invoke("save_note", { path: `${vaultPath}\\${node.path.replace(/\//g, '\\')}`, content }); } const hash = await computeContentHash(content); const ex = await database.select<any[]>("SELECT id FROM notes WHERE path = $1", [node.path]); if (ex.length === 0) await database.execute("INSERT INTO notes (id, path, last_synced, content, type, status, tags, content_hash) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)", [fileId, node.path, Date.now(), content, type, status, tags, hash]); else await database.execute("UPDATE notes SET id=$1, last_synced=$2, content=$3, type=$4, status=$5, tags=$6, content_hash=$7 WHERE path=$8", [fileId, Date.now(), content, type, status, tags, hash, node.path]); const headerRegex = new RegExp(ACTION_HEADER_MARKER, 'i'); if (headerRegex.test(content)) { const p = content.split(headerRegex); if (p[1]) { const lines = p[1].split("\n"); for (const l of lines) { if (l.trim().startsWith("|") && !l.includes("---") && !l.includes("ID")) { const c = l.split("|").map(x => x.trim()); if (c.length >= 7) { const code = c[1]; if (code) { await database.execute("INSERT INTO actions VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)", [generateUUID(), node.path, code, c[2].includes("x") ? 'DONE' : 'TODO', c[6], c[5], c[3], c[4], c[7] || ""]); } } } } } } } catch (fileErr) { console.error("Skipped bad file:", node.path, fileErr); } } setSyncStatus("READY"); const acts = await database.select<any[]>("SELECT * FROM actions"); setGlobalActions(acts.map(a => ({ ...a, status: a.status === 'DONE', collapsed: false }))); const allSources = new Set(acts.map(a => a.note_path || "Unknown")); setExpandedSources(allSources); } catch (e) { setSyncStatus("ERROR"); console.error(e); } };
  const findRelated = async (path: string, tags: string, d: Database) => { if (!tags) { setRelatedNotes([]); return; } const t = tags.split(/[;,]/).map(x => x.trim()).filter(x => x); if (t.length === 0) { setRelatedNotes([]); return; } let sql = "SELECT id, path, tags FROM notes WHERE path != $1 AND ("; const p: any[] = [path]; t.forEach((tag, i) => { if (i > 0) sql += " OR "; sql += `tags LIKE $${i + 2}`; p.push(`%${tag}%`); }); sql += ") LIMIT 5"; const r = await d.select<Note[]>(sql, p); setRelatedNotes(r); };
  const findBacklinks = async (path: string, d: Database) => { const n = path.split('/').pop()?.replace('.md', '') || ""; const p = path.replace('.md', ''); const r = await d.select<Note[]>("SELECT id, path FROM notes WHERE path != $1 AND (content LIKE $2 OR content LIKE $3)", [path, `%[[${p}]]%`, `%[[${n}]]%`]); setBacklinks(r); };
  const handleRename = async () => { const target = activeFile || selectedFolder; if (!target) return; const oldName = target.split('/').pop() || ""; let newName = prompt(`Renommer "${oldName}" en :`, oldName); if (!newName || newName === oldName) return; if (target.endsWith('.md') && !newName.endsWith('.md')) { newName += '.md'; } try { await invoke("rename_item", { vaultPath, oldPath: target, newName }); if (target.endsWith('.md')) { const folder = target.includes('/') ? target.substring(0, target.lastIndexOf('/')) : ""; const newPathRel = folder ? `${folder}/${newName}` : newName; const oldLink = target.replace('.md', ''); const newLink = newPathRel.replace('.md', ''); await invoke("update_links_on_move", { vaultPath, oldPathRel: oldLink, newPathRel: newLink }); setActiveFile(newPathRel); } else { setSelectedFolder(""); } await handleScan(); } catch (e) { alert("Erreur Renommage: " + e); } };
  const handleNodeClick = async (node: FileNode) => { if (node.is_dir) { if (selectedFolder === node.path) setSelectedFolder(""); else setSelectedFolder(node.path); setActiveFile(""); } else { setActiveFile(node.path); const ext = node.path.split('.').pop()?.toLowerCase() || ""; setActiveExtension(ext); if (ext === 'md') { const parent = node.path.includes('/') ? node.path.substring(0, node.path.lastIndexOf('/')) : ""; setSelectedFolder(parent); const c = await invoke<string>("read_note", { path: `${vaultPath}\\${node.path}` }); parseFullFile(c, node.path); setIsDirty(false); } else { setBodyContent(""); setLocalActions([]); } setCurrentTab('COCKPIT'); } };
  const handleFlashNote = async () => { try { const now = new Date(); const yyyy = now.getFullYear(); const mm = String(now.getMonth() + 1).padStart(2, '0'); const dd = String(now.getDate()).padStart(2, '0'); const dateStr = `${yyyy}${mm}${dd}`; const inboxPath = "01_Inbox"; await invoke("create_folder", { path: `${vaultPath}\\${inboxPath}` }); let inc = 1; let finalName = `${dateStr}_${inc}_Note à classer.md`; while (fileTree.some(n => n.path === `${inboxPath}/${finalName}`)) { inc++; finalName = `${dateStr}_${inc}_Note à classer.md`; } const fullPath = `${vaultPath}\\${inboxPath}\\${finalName}`; const newId = generateUUID(); const content = `# ${finalName.replace('.md', '')}\n\nFlash Note créée le ${now.toLocaleString()}\n\n\n\n${METADATA_SEPARATOR}\nID: ${newId}\nTYPE: NOTE\nSTATUS: INBOX\nTAGS: `; await invoke("create_note", { path: fullPath, content }); await handleScan(); setActiveFile(`${inboxPath}/${finalName}`); setSelectedFolder(inboxPath); parseFullFile(content, `${inboxPath}/${finalName}`); setCurrentTab('COCKPIT'); } catch (e) { alert("Erreur Flash: " + e); } };
  const handleCreateNote = async () => { try { let targetFolder = selectedFolder; if (!targetFolder && activeFile) { const lastSlash = activeFile.lastIndexOf('/'); if (lastSlash !== -1) { targetFolder = activeFile.substring(0, lastSlash); } } const baseName = "Untitled"; let finalName = `${baseName}.md`; let counter = 1; const getRelPath = (name: string) => targetFolder ? `${targetFolder}/${name}` : name; while (fileTree.some(n => n.path === getRelPath(finalName))) { finalName = `${baseName} ${counter}.md`; counter++; } const fullPath = targetFolder ? `${vaultPath}\\${targetFolder}\\${finalName}`.replace(/\//g, '\\') : `${vaultPath}\\${finalName}`; const newId = generateUUID(); const content = `# ${finalName.replace('.md', '')}\n\nCreated: ${new Date().toLocaleString()}\n\n\n\n${METADATA_SEPARATOR}\nID: ${newId}\nTYPE: NOTE\nSTATUS: ACTIVE\nTAGS: `; await invoke("create_note", { path: fullPath, content }); await handleScan(); const relativePath = getRelPath(finalName); setActiveFile(relativePath); setSelectedFolder(targetFolder); parseFullFile(content, relativePath); setCurrentTab('COCKPIT'); } catch (e) { alert("Erreur Création Note: " + e); } };
  const handleCreateFolder = async () => { const parent = selectedFolder ? `DANS ${selectedFolder}` : "à la RACINE"; const name = prompt(`Nom du nouveau dossier (${parent}) :`); if (!name) return; const path = selectedFolder ? `${selectedFolder}/${name}` : name; await invoke("create_folder", { path: `${vaultPath}\\${path.replace(/\//g, '\\')}` }); await handleScan(); };
  const handleDelete = async () => { const target = activeFile || selectedFolder; if (!target) return; if (confirm(`Supprimer définitivement ${target} ?`)) { if (target.endsWith('.md')) await invoke("delete_note", { path: `${vaultPath}\\${target.replace(/\//g, '\\')}` }); else await invoke("delete_folder", { path: `${vaultPath}\\${target.replace(/\//g, '\\')}` }); setActiveFile(""); setSelectedFolder(""); await handleScan(); } };
  const handleDragEnd = async (event: DragEndEvent) => { const { active, over } = event; if (!over || active.id === over.id) return; try { const activePath = active.id as string; const targetFolder = over.id === "ROOT_ZONE" ? "" : (over.id as string); const currentFolder = activePath.substring(0, activePath.lastIndexOf('/')); if (currentFolder === targetFolder) { console.log("Drag annulé"); return; } const fullSource = `${vaultPath}\\${activePath.replace(/\//g, '\\')}`; const fullDest = targetFolder ? `${vaultPath}\\${targetFolder.replace(/\//g, '\\')}` : `${vaultPath}`; await invoke("move_file_system_entry", { sourcePath: fullSource, destinationFolder: fullDest }); const fileName = activePath.split('/').pop() || ""; const oldLink = activePath.replace('.md', ''); const newPathRel = targetFolder ? `${targetFolder}/${fileName}` : fileName; const newLink = newPathRel.replace('.md', ''); if (oldLink !== newLink) { await invoke("update_links_on_move", { vaultPath, oldPathRel: oldLink, newPathRel: newLink }); } await handleScan(); } catch (e) { alert("Move Error: " + e); } };
  const handleInsertLink = (node: FileNode) => { if (!activeFile) return; const ta = textAreaRef.current; if (!ta) return; const txt = `[[${node.path.replace('.md', '')}]]`; const s = ta.selectionStart; const e = ta.selectionEnd; const prev = bodyContent.charAt(s - 1); const pad = (s > 0 && prev !== ' ' && prev !== '\n') ? ' ' : ''; const n = bodyContent.substring(0, s) + pad + txt + bodyContent.substring(e); handleContentChange(n); setTimeout(() => { ta.focus(); const pos = s + pad.length + txt.length; ta.selectionStart = pos; ta.selectionEnd = pos; }, 0); };
  const toggleFolderExpand = (path: string) => { const next = new Set(expandedFolders); if (next.has(path)) next.delete(path); else next.add(path); setExpandedFolders(next); };
  const toggleSourceExpand = (source: string) => { const next = new Set(expandedSources); if (next.has(source)) next.delete(source); else next.add(source); setExpandedSources(next); };
  const handleSave = async () => { if (activeFile && activeExtension === 'md') { const p = `${vaultPath}\\${activeFile.replace(/\//g, '\\')}`; const c = constructFullFile(bodyContent, localActions, metadata); await invoke("save_note", { path: p, content: c }); await handleScan(); setIsDirty(false); } };
  const addAction = (parentId?: string) => { let newCode = ""; if (parentId) { const siblings = localActions.filter(a => a.code.startsWith(parentId + ".") && a.code.split('.').length === parentId.split('.').length + 1); let maxSuffix = 0; siblings.forEach(s => { const parts = s.code.split('.'); const suffix = parseInt(parts[parts.length - 1] || "0"); if (suffix > maxSuffix) maxSuffix = suffix; }); newCode = `${parentId}.${maxSuffix + 1}`; setLocalActions(prev => prev.map(a => a.code === parentId ? { ...a, collapsed: false } : a)); } else { const roots = localActions.filter(a => !a.code.includes(".")); let maxRoot = 0; roots.forEach(r => { const val = parseInt(r.code); if (val > maxRoot) maxRoot = val; }); newCode = (maxRoot + 1).toString(); } const newItem = { id: generateUUID(), code: newCode, status: false, created: getTodayDate(), deadline: "", owner: "", task: "", comment: "", collapsed: false, note_path: activeFile }; setLocalActions(prev => sortActionsSemantic([...prev, newItem])); setIsDirty(true); };
  const updateAction = (id: string, k: keyof ActionItem, v: any) => { setLocalActions(prev => prev.map(a => a.id === id ? { ...a, [k]: v } : a)); setIsDirty(true); };
  const removeAction = (id: string) => { setLocalActions(prev => prev.filter(a => a.id !== id)); setIsDirty(true); };
  const toggleLocalCollapse = (code: string) => { setLocalActions(prev => prev.map(a => a.code === code ? { ...a, collapsed: !a.collapsed } : a)); };
  const isVisibleInCockpit = (action: ActionItem, list: ActionItem[]) => { if (!action.code.includes('.')) return true; const parts = action.code.split('.'); let currentCode = parts[0]; for (let i = 0; i < parts.length - 1; i++) { const parent = list.find(a => a.code === currentCode); if (parent && parent.collapsed) return false; currentCode += `.${parts[i + 1]}`; } return true; };
  const isVisibleInMasterGroup = (action: ActionItem, list: ActionItem[]) => { if (!action.code.includes('.')) return true; const parts = action.code.split('.'); let currentCode = parts[0]; for (let i = 0; i < parts.length - 1; i++) { const parent = list.find(a => a.note_path === action.note_path && a.code === currentCode); if (parent && parent.collapsed) return false; currentCode += `.${parts[i + 1]}`; } return true; };
  const toggleGlobalCollapse = (notePath: string, code: string) => { setGlobalActions(prev => prev.map(a => (a.note_path === notePath && a.code === code) ? { ...a, collapsed: !a.collapsed } : a)); };
  const openNote = async (notePath: string) => { if (!notePath) return; try { const fullPath = `${vaultPath}\\${notePath.replace(/\//g, '\\')}`; const content = await invoke<string>("read_note", { path: fullPath }); setActiveFile(notePath); const folder = notePath.includes('/') ? notePath.substring(0, notePath.lastIndexOf('/')) : ""; setSelectedFolder(folder); parseFullFile(content, notePath); setIsDirty(false); setCurrentTab('COCKPIT'); } catch (e) { alert("Erreur ouverture: " + e); } };
  const toggleActionFromMaster = async (action: ActionItem) => { if (!action.note_path) return; try { const fullPath = `${vaultPath}\\${action.note_path.replace(/\//g, '\\')}`; const content = await invoke<string>("read_note", { path: fullPath }); const clean = content.replace(/\r\n/g, "\n"); let fileBody = clean; let fileMeta = { id: "", type: "NOTE", status: "ACTIVE", tags: "" }; let fileActions: ActionItem[] = []; if (clean.includes(METADATA_SEPARATOR)) { const parts = clean.split(METADATA_SEPARATOR); fileBody = parts[0]; const m = parts[1]; if (m) { if (m.includes("ID:")) fileMeta.id = m.split("ID:")[1].split("\n")[0].trim(); if (m.includes("TYPE:")) fileMeta.type = m.split("TYPE:")[1].split("\n")[0].trim(); if (m.includes("STATUS:")) fileMeta.status = m.split("STATUS:")[1].split("\n")[0].trim(); if (m.includes("TAGS:")) fileMeta.tags = m.split("TAGS:")[1].split("\n")[0].trim(); } } if (clean.includes(ACTION_HEADER_MARKER)) { const parts = clean.split(ACTION_HEADER_MARKER); fileBody = parts[0]; if (parts[1]) parts[1].split("\n").forEach(l => { if (l.trim().startsWith("|") && !l.includes("---") && !l.includes("ID")) { const c = l.split("|").map(x => x.trim()); if (c.length >= 7) fileActions.push({ id: generateUUID(), code: c[1], status: c[2].includes("x"), created: c[3], deadline: c[4], owner: c[5], task: c[6], comment: c[7] || "", note_path: action.note_path }); } }); } const target = fileActions.find(a => a.code === action.code); if (target) target.status = !target.status; const newContent = constructFullFile(fileBody.trim(), fileActions, fileMeta); await invoke("save_note", { path: fullPath, content: newContent }); setGlobalActions(prev => prev.map(a => (a.note_path === action.note_path && a.code === action.code) ? { ...a, status: !a.status } : a)); if (db) await db.execute("UPDATE actions SET status = $1 WHERE note_path = $2 AND code = $3", [target?.status ? 'DONE' : 'TODO', action.note_path, action.code]); } catch (err) { alert("Erreur Master: " + err); } };
  const requestSort = (key: keyof ActionItem) => { let direction: 'asc' | 'desc' = 'asc'; if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') { direction = 'desc'; } setSortConfig({ key, direction }); };
  const filteredActions = globalActions.filter(action => { if (!filterText) return true; const lowerSearch = filterText.toLowerCase(); return ((action.task && action.task.toLowerCase().includes(lowerSearch)) || (action.owner && action.owner.toLowerCase().includes(lowerSearch)) || (action.comment && action.comment.toLowerCase().includes(lowerSearch)) || (action.note_path && action.note_path.toLowerCase().includes(lowerSearch))); });
  const uniqueSources = Array.from(new Set(filteredActions.map(a => a.note_path || "Inconnu"))).sort();
  const handleOpenExternal = async () => { if (!activeFile || !vaultPath) return; const fullPath = `${vaultPath}\\${activeFile.replace(/\//g, '\\')}`; try { await invoke("open_file", { path: fullPath }); } catch (e) { alert("Erreur ouverture: " + e); } };

  // RENDERING
  const renderMailbox = () => {
    return (
      <div className="flex h-full bg-gray-900/50 text-white">
        {/* MAIL FOLDERS */}
        <div className="w-48 bg-gray-950 border-r border-gray-900 p-4 flex flex-col gap-2">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Dossiers</h3>
          <button className="text-left px-3 py-1.5 rounded bg-blue-900/30 text-blue-300 font-bold text-xs">📥 Inbox</button>
          <button className="text-left px-3 py-1.5 rounded hover:bg-gray-900 text-gray-400 text-xs">📤 Sent</button>
          <button className="text-left px-3 py-1.5 rounded hover:bg-gray-900 text-gray-400 text-xs">🗄️ Archive</button>
          <div className="mt-auto pt-4 border-t border-gray-900">
            <div className="text-[10px] text-gray-600 mb-2">STATUS: <span className={isConnected ? "text-green-500" : "text-red-500"}>{connectionStatus}</span></div>
            <button onClick={handleConnectOutlook} className="w-full bg-blue-700 hover:bg-blue-600 text-white text-[10px] py-2 rounded font-bold uppercase">Connect Outlook</button>
          </div>
        </div>

        {/* MAIL LIST */}
        <div className="w-80 bg-black border-r border-gray-900 overflow-y-auto">
          {emails.length === 0 ? (
            <div className="p-10 text-center text-gray-600 text-xs">Aucun message.<br />Cliquez sur Connect.</div>
          ) : (
            emails.map(email => (
              <div key={email.id} onClick={() => setSelectedEmail(email)} className={`p-4 border-b border-gray-900 cursor-pointer hover:bg-gray-900/50 ${selectedEmail?.id === email.id ? 'bg-blue-900/10 border-l-2 border-l-blue-500' : ''}`}>
                <div className="flex justify-between mb-1">
                  <span className={`text-xs font-bold ${email.is_read ? 'text-gray-500' : 'text-white'}`}>{email.sender}</span>
                  <span className="text-[10px] text-gray-600">{email.received}</span>
                </div>
                <div className={`text-sm mb-1 truncate ${email.is_read ? 'text-gray-400' : 'text-gray-200 font-medium'}`}>{email.subject}</div>
                <div className="text-xs text-gray-600 truncate">{email.body_preview}</div>
              </div>
            ))
          )}
        </div>

        {/* READING PANE */}
        <div className="flex-1 bg-gray-950 p-8 overflow-y-auto">
          {selectedEmail ? (
            <div>
              <h2 className="text-2xl font-bold text-white mb-4">{selectedEmail.subject}</h2>
              <div className="flex gap-4 items-center mb-8 border-b border-gray-800 pb-4">
                <div className="w-10 h-10 rounded-full bg-purple-900 flex items-center justify-center text-lg font-bold text-purple-300">
                  {selectedEmail.sender.charAt(0)}
                </div>
                <div>
                  <div className="text-sm font-bold text-white">{selectedEmail.sender}</div>
                  <div className="text-xs text-gray-500">Reçu le {selectedEmail.received}</div>
                </div>
                <div className="ml-auto flex gap-2">
                  <button className="px-3 py-1 bg-gray-800 text-gray-300 text-xs rounded hover:bg-gray-700">Répondre</button>
                  <button className="px-3 py-1 bg-blue-900/30 text-blue-300 text-xs rounded hover:bg-blue-900/50 border border-blue-900">Convertir en Note</button>
                </div>
              </div>
              <div className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                {selectedEmail.body_preview}
                <br /><br />
                (Contenu complet non chargé dans cette version démo)
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-700">Sélectionnez un email pour le lire</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen w-screen bg-black text-white flex flex-col overflow-hidden font-sans select-none" onMouseUp={stopResizing}>
      <style>{`.custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }`}</style>
      <div className="h-10 bg-gray-950 border-b border-gray-900 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-6">
          <span className="text-gray-500 text-xs font-bold tracking-widest uppercase flex gap-2 items-center"><div className={`w-2 h-2 rounded-full ${status.includes("FAILURE") ? 'bg-red-500' : 'bg-green-500'}`}></div>AEGIS V10.19 MESSAGERIE</span>
          <div className="flex gap-1 bg-gray-900 p-1 rounded">
            <button onClick={() => setCurrentTab('COCKPIT')} className={`px-4 py-1 text-xs font-bold rounded ${currentTab === 'COCKPIT' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}>COCKPIT</button>
            <button onClick={() => { setCurrentTab('MASTER_PLAN'); handleScan(); }} className={`px-4 py-1 text-xs font-bold rounded ${currentTab === 'MASTER_PLAN' ? 'bg-purple-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}>MASTER PLAN</button>
            {/* NEW TAB BUTTON */}
            <button onClick={() => setCurrentTab('MAILBOX')} className={`px-4 py-1 text-xs font-bold rounded ${currentTab === 'MAILBOX' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}>MESSAGERIE</button>
          </div>
        </div>
        <div className="text-[10px] text-gray-600">{syncStatus}</div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* SIDEBAR AVEC RECHERCHE */}
        <div style={{ width: sidebarWidth }} className="shrink-0 flex flex-col h-full bg-gray-950 border-r border-gray-900 overflow-hidden relative">
          <Sidebar
            fileTree={fileTree} activeFile={activeFile} selectedFolder={selectedFolder} expandedFolders={expandedFolders}
            onToggleExpand={toggleFolderExpand} onNodeClick={handleNodeClick} onDragEnd={handleDragEnd}
            onCreateFolder={handleCreateFolder} onCreateNote={handleCreateNote}
            onFlashNote={handleFlashNote} onRename={handleRename} onDelete={handleDelete}
            onCloseVault={handleCloseVault} onInsertLink={handleInsertLink}
            onClearSelection={() => { setSelectedFolder(""); setActiveFile(""); }}
            searchQuery={searchQuery}
            onSearch={handleGlobalSearch}
            searchResults={searchResults}
          />
          <div onMouseDown={startResizingLeft} className="absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-blue-600/50 transition-colors z-50"></div>
        </div>

        <div className="flex-1 bg-black flex flex-col relative overflow-hidden min-w-0">
          {currentTab === 'COCKPIT' ? (
            activeFile ? (
              <>
                <div className="h-12 border-b border-gray-900 flex items-center justify-between px-6 bg-gray-950/50 shrink-0">
                  <span className="font-mono text-sm text-gray-200 truncate max-w-md">{activeFile}</span>
                  <div className="flex gap-2">
                    <button onClick={handleRename} className="text-xs bg-gray-800 text-gray-300 px-3 py-1.5 rounded hover:bg-gray-700">RENAME</button>
                    {activeExtension === 'md' && (
                      <>
                        {isDirty && <span className="text-yellow-600 text-[10px] font-bold uppercase mr-3 self-center">Unsaved</span>}
                        <button onClick={handleSave} className="text-xs bg-blue-600 text-white px-4 py-1.5 rounded font-bold">SAVE</button>
                      </>
                    )}
                    <button onClick={handleDelete} className="text-xs bg-red-900/20 text-red-400 px-3 py-1.5 rounded">TRASH</button>
                  </div>
                  {activeExtension !== 'md' && (<button onClick={handleOpenExternal} className="text-xs bg-blue-900/50 text-blue-300 border border-blue-800 px-3 py-1.5 rounded hover:bg-blue-800 transition-colors ml-2">↗ OUVRIR</button>)}
                </div>
                {/* RENDER CONTENT (Legacy Function) */}
                {(() => {
                  if (!activeFile) {
                    if (selectedFolder) {
                      return (
                        <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-6">
                          <div className="text-6xl opacity-50">📂</div>
                          <div className="text-center">
                            <div className="text-xl font-bold text-gray-300 mb-2">Dossier Sélectionné</div>
                            <div className="text-sm font-mono bg-gray-900 px-3 py-1 rounded text-blue-300 mb-6">{selectedFolder}</div>
                            <div className="flex gap-4">
                              <button onClick={handleRename} className="bg-gray-800 hover:bg-gray-700 text-white font-bold py-2 px-6 rounded border border-gray-700 transition-colors">RENAME</button>
                              <button onClick={handleDelete} className="bg-red-900/50 hover:bg-red-900 text-red-200 font-bold py-2 px-6 rounded border border-red-800 transition-colors">DELETE</button>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return <div className="h-full flex items-center justify-center text-gray-800">NO FILE SELECTED</div>;
                  }
                  if (activeExtension === 'md') {
                    return (
                      <div className="flex-1 overflow-auto p-6 max-w-6xl mx-auto w-full flex flex-col gap-6">
                        <div className="bg-gray-900/30 border border-gray-800 rounded-lg overflow-hidden flex flex-col max-h-[40vh]">
                          <div className="bg-gray-900 px-4 py-2 border-b border-gray-800 flex justify-between items-center shrink-0">
                            <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider">⚡ Action Plan</h3>
                            <div className="flex gap-2">
                              <button onClick={() => handleExportExcel(localActions, activeFile.replace('.md', ''))} className="text-[10px] bg-green-900/30 hover:bg-green-900/50 text-green-300 px-2 py-1 rounded border border-green-900/50">📊 EXPORT XLS</button>
                              <button onClick={() => addAction()} className="text-[10px] bg-blue-900/30 hover:bg-blue-900/50 text-blue-300 px-2 py-1 rounded border border-blue-900/50">+ TASK</button>
                            </div>
                          </div>
                          <div className="p-2 overflow-y-auto flex-1">
                            {localActions.map((action) => {
                              if (!isVisibleInCockpit(action, localActions)) return null;
                              const hasChildren = localActions.some(a => a.code.startsWith(action.code + "."));
                              return (
                                <div key={action.id} style={{ marginLeft: `${(action.code.split('.').length - 1) * 24}px` }} className="flex items-center gap-2 bg-black/40 p-1.5 rounded border border-gray-800/50 group hover:border-blue-900/50 transition-colors mb-1">
                                  {hasChildren ? (<button onClick={() => toggleLocalCollapse(action.code)} className="text-gray-500 w-4 text-[10px] hover:text-white font-mono border border-gray-700 rounded bg-gray-900 h-4 flex items-center justify-center">{action.collapsed ? '+' : '-'}</button>) : <div className="w-4"></div>}
                                  <input type="checkbox" checked={action.status} onChange={(e) => updateAction(action.id, 'status', e.target.checked)} className="w-4 h-4 cursor-pointer accent-blue-500 shrink-0" />
                                  <input type="text" value={action.code} onChange={(e) => updateAction(action.id, 'code', e.target.value)} className="w-10 bg-gray-800 border-none text-xs text-center text-blue-300 rounded focus:bg-gray-700 font-mono" />
                                  <input type="text" value={action.task} onChange={(e) => updateAction(action.id, 'task', e.target.value)} className={`flex-1 bg-transparent border-none text-sm focus:outline-none ${action.status ? 'text-gray-500 line-through' : 'text-gray-200'}`} placeholder="Action..." />
                                  <input type="text" value={action.owner} onChange={(e) => updateAction(action.id, 'owner', e.target.value)} className="w-20 bg-gray-900/50 border border-gray-800 text-xs text-center text-gray-400 rounded focus:text-blue-300 focus:border-blue-800" placeholder="Pilot" />
                                  <input type="date" value={action.deadline} onChange={(e) => updateAction(action.id, 'deadline', e.target.value)} className="w-24 bg-gray-900/50 border border-gray-800 text-xs text-center text-gray-400 rounded focus:text-yellow-500 focus:border-yellow-800" />
                                  <input type="text" value={action.comment || ""} onChange={(e) => updateAction(action.id, 'comment', e.target.value)} className="w-56 bg-gray-900/50 border border-gray-800 text-xs text-gray-400 rounded focus:text-white focus:border-gray-600 px-2" placeholder="Comment..." />
                                  <button onClick={() => addAction(action.code)} className="text-[9px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded hover:bg-gray-700 hover:text-white" title="Sub-task">↪</button>
                                  <button onClick={() => removeAction(action.id)} className="text-gray-700 hover:text-red-500 px-1 opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <div className="flex-1 min-h-[400px] border-t border-gray-900 pt-4">
                          <textarea ref={textAreaRef} className="w-full h-full bg-black text-gray-300 font-mono text-base resize-none focus:outline-none leading-relaxed" value={bodyContent} onChange={(e) => handleContentChange(e.target.value)} spellCheck={false} placeholder="Write your note here..." />
                        </div>
                      </div>
                    );
                  } else {
                    return (
                      <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-6">
                        <div className="text-6xl opacity-50">{activeExtension === 'pdf' ? '📕' : activeExtension === 'xlsx' ? '📊' : '📦'}</div>
                        <div className="text-center">
                          <div className="text-xl font-bold text-gray-300 mb-2">Fichier Externe</div>
                          <div className="text-sm font-mono bg-gray-900 px-3 py-1 rounded text-blue-300 mb-4">{activeFile}</div>
                          <p className="max-w-md text-center text-xs text-gray-600 mb-6">Pour garantir un affichage parfait, Aegis délègue la lecture de ce fichier<br /> à votre application système par défaut.</p>
                          <button onClick={handleOpenExternal} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-8 rounded shadow-lg shadow-blue-900/20 transition-all flex items-center gap-3"><span>🚀</span> OUVRIR LE FICHIER</button>
                        </div>
                      </div>
                    );
                  }
                })()}
              </>
            ) : (
              /* V10.15 : GESTION FOLDER VIEW SI AUCUN FICHIER */
              // On duplique la logique renderContent pour le cas "no active file" car je suis dans un bloc ternaire
              selectedFolder ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-6">
                  <div className="text-6xl opacity-50">📂</div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-gray-300 mb-2">Dossier Sélectionné</div>
                    <div className="text-sm font-mono bg-gray-900 px-3 py-1 rounded text-blue-300 mb-6">{selectedFolder}</div>
                    <div className="flex gap-4">
                      <button onClick={handleRename} className="bg-gray-800 hover:bg-gray-700 text-white font-bold py-2 px-6 rounded border border-gray-700 transition-colors">RENAME</button>
                      <button onClick={handleDelete} className="bg-red-900/50 hover:bg-red-900 text-red-200 font-bold py-2 px-6 rounded border border-red-800 transition-colors">DELETE</button>
                    </div>
                  </div>
                </div>
              ) : <div className="h-full flex items-center justify-center text-gray-800">NO FILE SELECTED</div>
            )
          ) : currentTab === 'MASTER_PLAN' ? (
            <div className="flex flex-col h-full bg-gray-950/50">
              {/* ... MASTER PLAN UI ... */}
              <div className="h-16 border-b border-gray-900 flex items-center px-8 bg-black shrink-0">
                <h2 className="text-xl font-bold text-white tracking-widest flex items-center gap-3"><span className="text-purple-500">◈</span> GLOBAL MASTER PLAN</h2>
                <div className="flex items-center gap-4">
                  <button onClick={() => handleScan(db)} className="text-gray-500 hover:text-white transition-colors" title="Force Reload">↻</button>
                  <input type="text" placeholder="Filter..." value={filterText} onChange={(e) => setFilterText(e.target.value)} className="ml-4 bg-gray-900 border border-gray-800 text-xs text-white px-3 py-1 rounded w-64 focus:border-purple-500 focus:outline-none" />
                  <button onClick={() => handleExportExcel(filteredActions, "Master_Plan")} className="bg-green-800 hover:bg-green-700 text-white text-xs px-4 py-1.5 rounded font-bold transition-colors">EXPORT XLS</button>
                </div>
                <div className="ml-auto text-xs text-gray-500">{filteredActions.length} actions</div>
              </div>
              <div className="flex-1 overflow-auto p-8">
                <div className="flex gap-2 px-4 py-2 bg-gray-900/50 text-[10px] text-gray-500 uppercase tracking-wider font-bold shrink-0 border-b border-gray-800 mb-2"> <div className="w-6"></div><div className="w-10">ID</div><div className="flex-1">Action</div> <div onClick={() => requestSort('owner')} className="w-20 text-center cursor-pointer">Pilot</div> <div onClick={() => requestSort('deadline')} className="w-24 text-center cursor-pointer">Deadline</div> <div className="w-64 text-center">Comment</div> <div className="w-24 text-center">Open</div> </div>
                <div className="space-y-4"> {uniqueSources.map(source => { let actionsInSource = filteredActions.filter(a => (a.note_path || "Inconnu") === source); if (sortConfig) { actionsInSource.sort((a, b) => { const valA = a[sortConfig.key] || ""; const valB = b[sortConfig.key] || ""; if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1; if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1; return 0; }); } const isExpanded = expandedSources.has(source); return (<div key={source} className="border border-gray-800/50 rounded overflow-hidden bg-gray-900/10"> <div onClick={() => toggleSourceExpand(source)} className="flex items-center gap-3 px-4 py-2 bg-gray-900 cursor-pointer hover:bg-gray-800 transition-colors select-none"> <span className="text-xs text-gray-400">{isExpanded ? '▼' : '▶'}</span> <span className="text-sm font-bold text-purple-300 font-mono truncate">{source}</span> <span className="text-[10px] bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full">{actionsInSource.length}</span> </div> {isExpanded && (<div className="p-2 border-t border-gray-800 bg-black/20"> {actionsInSource.map((action) => { if (!isVisibleInMasterGroup(action, actionsInSource)) return null; const depth = action.code.split('.').length - 1; const hasChildren = actionsInSource.some(a => a.code.startsWith(action.code + ".")); return (<div key={action.id} style={{ marginLeft: `${depth * 24}px` }} className="flex items-center gap-2 bg-gray-900/20 p-1.5 rounded border border-gray-800/50 group hover:border-purple-500/30 hover:bg-gray-900/40 transition-all mb-1"> {hasChildren ? (<button onClick={() => toggleGlobalCollapse(action.note_path || "", action.code)} className="text-gray-500 w-4 text-[10px] hover:text-white font-mono border border-gray-700 rounded bg-gray-900 h-4 flex items-center justify-center"> {action.collapsed ? '+' : '-'} </button>) : <div className="w-4"></div>} <input type="checkbox" checked={action.status} onChange={() => toggleActionFromMaster(action)} className="w-4 h-4 cursor-pointer accent-purple-500 shrink-0" /> <div className="w-10 bg-gray-900/50 text-xs text-center text-blue-400 rounded font-mono py-1 border border-gray-800">{action.code}</div> <div className={`flex-1 text-sm ${action.status ? 'text-gray-500 line-through' : 'text-gray-300'} truncate px-2`} title={action.task}>{action.task}</div> <div className="w-20 bg-gray-900/50 border border-gray-800 text-xs text-center text-gray-500 rounded py-1">{action.owner || '-'}</div> <div className="w-24 bg-gray-900/50 border border-gray-800 text-xs text-center text-yellow-700/70 rounded py-1">{action.deadline || '-'}</div> <div className="w-64 bg-gray-900/50 border border-gray-800 text-xs text-left text-gray-400 rounded py-1 px-2 italic whitespace-normal break-words leading-tight" title={action.comment}>{action.comment}</div> <button onClick={() => openNote(action.note_path || "")} className="w-24 bg-gray-900/50 hover:bg-blue-900/30 border border-gray-800 hover:border-blue-700 text-[10px] text-gray-500 hover:text-blue-300 rounded py-1 truncate transition-colors text-center"> Ouvrir </button> </div>); })} </div>)} </div>); })} </div>
              </div>
            </div>
          ) : (
            // MAILBOX RENDER
            renderMailbox()
          )}
        </div>

        {/* METADATA SIDEBAR - RESIZABLE RIGHT */}
        {currentTab === 'COCKPIT' && (
          <div style={{ width: rightSidebarWidth }} className="bg-gray-950 border-l border-gray-900 flex flex-col p-6 gap-6 overflow-y-auto transition-all shrink-0 relative">
            <div onMouseDown={startResizingRight} className="absolute left-0 top-0 w-2 h-full cursor-col-resize hover:bg-blue-600/50 transition-colors z-50"></div>
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-900 pb-2">Context Pilot</h3>
            {activeFile ? (
              <>
                {activeExtension === 'md' ? (
                  <>
                    {backlinks.length > 0 && (<div className="mb-4"> <h4 className="text-[10px] font-bold text-purple-400 uppercase tracking-wider mb-2 flex items-center gap-2">Cited By <span className="bg-purple-900/30 text-purple-400 px-1.5 rounded-full text-[9px]">{backlinks.length}</span></h4> <ul className="space-y-1 max-h-[100px] overflow-y-auto pr-2 custom-scrollbar"> {backlinks.map(backlink => (<li key={backlink.id} onClick={() => openNote(backlink.path)} className="group cursor-pointer bg-purple-900/10 border border-purple-900/30 hover:bg-purple-900/30 p-2 rounded transition-all"> <div className="flex items-center gap-2"> <span className="text-xs text-purple-300 group-hover:text-white truncate font-medium">⬅ {backlink.path.replace('.md', '')}</span> </div> </li>))} </ul> </div>)}
                    {detectedLinks.length > 0 && (<div className="mb-4"> <h4 className="text-[10px] font-bold text-green-500 uppercase tracking-wider mb-2 flex items-center gap-2">Going To <span className="bg-green-900/30 text-green-400 px-1.5 rounded-full text-[9px]">{detectedLinks.length}</span></h4> <ul className="space-y-1 max-h-[100px] overflow-y-auto pr-2 custom-scrollbar"> {detectedLinks.map(link => (<li key={link} onClick={() => openNote(link.endsWith('.md') ? link : `${link}.md`)} className="group cursor-pointer bg-green-900/10 border border-green-900/30 hover:bg-green-900/30 p-2 rounded transition-all"> <div className="flex items-center gap-2"> <span className="text-xs text-green-300 group-hover:text-white truncate font-medium">➡ {link}</span> </div> </li>))} </ul> </div>)}
                    <div className="space-y-4 pt-2 border-t border-gray-900">
                      <div> <label className="text-[10px] text-gray-600 font-bold uppercase mb-2 block">UUID (System)</label> <input type="text" value={metadata.id} disabled className="w-full bg-gray-900/50 border border-gray-900 text-gray-600 text-[9px] rounded p-2 font-mono select-all" /> </div>
                      <div> <label className="text-[10px] text-gray-600 font-bold uppercase mb-2 block">Project Status</label> <select value={metadata.status} onChange={(e) => { setMetadata({ ...metadata, status: e.target.value }); setIsDirty(true); }} className="w-full bg-gray-900 border border-gray-800 text-gray-300 text-xs rounded p-2 focus:border-blue-500 focus:outline-none"> <option value="ACTIVE">🟢 ACTIVE</option> <option value="HOLD">🟠 ON HOLD</option> <option value="DONE">🔵 COMPLETED</option> <option value="ARCHIVED">⚫ ARCHIVED</option> </select> </div>
                      <div> <label className="text-[10px] text-gray-600 font-bold uppercase mb-2 block">Entry Type</label> <div className="flex gap-2"> {['NOTE', 'PROJECT', 'TASK'].map(type => (<button key={type} onClick={() => { setMetadata({ ...metadata, type }); setIsDirty(true); }} className={`flex-1 py-2 text-[10px] font-bold rounded border ${metadata.type === type ? "bg-blue-900/30 border-blue-800 text-blue-400" : "bg-gray-900 border-gray-800 text-gray-500 hover:bg-gray-800"}`}>{type}</button>))} </div> </div>
                      <div> <label className="text-[10px] text-gray-600 font-bold uppercase mb-2 block">Tags (; separated)</label> <input type="text" value={metadata.tags} onChange={(e) => { setMetadata({ ...metadata, tags: e.target.value }); setIsDirty(true); }} className="w-full bg-gray-900 border border-gray-800 text-gray-300 text-xs rounded p-2 focus:border-blue-500 focus:outline-none font-mono" placeholder="tag1; tag2" /> </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center text-gray-700 text-xs mt-10">Métadonnées non disponibles<br />pour les fichiers externes.</div>
                )}
              </>
            ) : <div className="text-center text-gray-700 text-xs mt-10">No context available.</div>}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;