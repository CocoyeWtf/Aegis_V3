import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
    DndContext,
    DragEndEvent,
    useDraggable,
    useDroppable,
    useSensor,
    useSensors,
    PointerSensor,
    pointerWithin // V10.42 : ALGORITHME DE PRÉCISION SOURIS
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

// --- TYPES ---
export interface FileNode {
    name: string;
    path: string;
    is_dir: boolean;
    children: FileNode[];
    extension: string;
    content: string;
}

interface SidebarProps {
    fileTree: FileNode[];
    activeFile: string;
    selectedFolder: string;
    expandedFolders: Set<string>;
    onToggleExpand: (path: string) => void;
    onNodeClick: (node: FileNode) => void;
    onDragEnd: (event: DragEndEvent) => void;
    onCreateFolder: () => void;
    onCreateNote: () => void;
    onFlashNote: () => void;
    onRename: () => void;
    onDelete: () => void;
    onCloseVault: () => void;
    onInsertLink: (node: FileNode) => void;
    onClearSelection: () => void;
    searchQuery: string;
    onSearch: (query: string) => void;
    searchResults: FileNode[];
    // V11.90 : SPLIT EXPLORER (double panneau pour ranger en glisser-déposer)
    splitMode: boolean;
    onToggleSplit: () => void;
    splitRoot: string;
    onSetSplitRoot: (path: string) => void;
    expandedFoldersB: Set<string>;
    onToggleExpandB: (path: string) => void;
}

// V11.90 : helpers du split explorer
const collectDirs = (nodes: FileNode[]): string[] => {
    let out: string[] = [];
    for (const n of nodes) {
        if (n.is_dir) { out.push(n.path); out = out.concat(collectDirs(n.children || [])); }
    }
    return out;
};
const findChildren = (nodes: FileNode[], path: string): FileNode[] | null => {
    for (const n of nodes) {
        if (n.path === path) return n.is_dir ? (n.children || []) : null;
        if (n.is_dir && path.startsWith(n.path + '/')) { const r = findChildren(n.children || [], path); if (r) return r; }
    }
    return null;
};

// --- COMPOSANTS INTERNES ---

const SearchResultItem = ({ node, onNodeClick }: { node: FileNode, onNodeClick: (n: FileNode) => void }) => {
    return (
        <div
            onClick={(e) => { e.stopPropagation(); onNodeClick(node); }}
            className="flex items-center gap-2 py-2 px-3 cursor-pointer hover:bg-gray-800 border-b border-gray-900/50 group relative"
        >
            <span className="text-sm">📝</span>
            <div className="flex flex-col min-w-0">
                <span className="text-sm text-gray-300 group-hover:text-white truncate font-medium">{String(node.name)}</span>
                <span className="text-[10px] text-gray-500 truncate">{String(node.path)}</span>
            </div>
        </div>
    );
};

const FileItem = ({ node, level, activeFile, selectedFolder, expandedFolders, onToggleExpand, onNodeClick, onInsertLink, idPrefix }: any) => {
    const nodeName = String(node.name || "");
    const nodePath = String(node.path || "");
    const isSelected = activeFile === nodePath || selectedFolder === nodePath;
    const [tooltip, setTooltip] = useState<{ x: number, y: number } | null>(null);

    // Config Drag & Drop (idPrefix "B::" pour le second panneau : évite les collisions d'ids dnd-kit)
    const dndId = (idPrefix || '') + nodePath;
    const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({ id: dndId });
    const { setNodeRef: setDropRef, isOver } = useDroppable({ id: dndId, data: { isFolder: node.is_dir } });

    const style = {
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 999 : undefined,
        opacity: isDragging ? 0.6 : 1,
        position: isDragging ? 'relative' as const : undefined,
        touchAction: 'none'
    };

    const setRefs = (element: HTMLElement | null) => { setDragRef(element); if (node.is_dir) setDropRef(element); };

    return (
        <div style={style}>
            <div
                ref={setRefs} {...attributes} {...listeners}
                onMouseEnter={(e) => { const rect = e.currentTarget.getBoundingClientRect(); setTooltip({ x: rect.left + 40, y: rect.top + 20 }); }}
                onMouseLeave={() => setTooltip(null)}
                className={`
                    flex items-center gap-2 py-1.5 px-2 cursor-pointer select-none text-sm transition-colors relative group border-b border-transparent 
                    ${isSelected ? 'bg-amber-900/20 text-amber-100 border-l-2 border-l-amber-500' : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800'} 
                    ${isOver && node.is_dir ? 'bg-amber-900/40 ring-1 ring-amber-500/50' : ''}
                `}
                style={{ paddingLeft: `${level * 16 + 12}px` }}
                onClick={(e) => { e.stopPropagation(); onNodeClick(node); }}
            >
                {node.is_dir ? (
                    <span onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onToggleExpand(nodePath); }} className="w-5 h-5 flex items-center justify-center text-amber-500 hover:text-white hover:bg-gray-700 rounded transition-colors font-bold text-xs bg-gray-900/50 border border-gray-700 mr-1">
                        {expandedFolders.has(nodePath) ? '▾' : '▸'}
                    </span>
                ) : (<span className="w-5 mr-1"></span>)}

                <span className={`text-xs ${node.is_dir ? 'text-amber-500' : 'text-gray-500'}`}>{node.is_dir ? '📁' : node.extension === 'md' ? '📝' : '📄'}</span>
                <span className="truncate flex-1 font-medium">{nodeName}</span>

                {!node.is_dir && node.extension === 'md' && (
                    <button onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onInsertLink(node); }} className="opacity-0 group-hover:opacity-100 text-[10px] text-gray-500 hover:text-amber-400 px-1" title="Insérer lien">🔗</button>
                )}

                {tooltip && createPortal(<div className="fixed z-[9999] bg-black border border-amber-600/50 text-amber-100 text-xs px-2 py-1 rounded shadow-xl whitespace-nowrap pointer-events-none" style={{ top: tooltip.y, left: tooltip.x }}>{nodeName}</div>, document.body)}
            </div>
            {node.is_dir && expandedFolders.has(nodePath) && Array.isArray(node.children) && (
                <div>
                    {node.children.map((child: any) => (
                        <FileItem key={String(child.path)} node={child} level={level + 1} activeFile={activeFile} selectedFolder={selectedFolder} expandedFolders={expandedFolders} onToggleExpand={onToggleExpand} onNodeClick={onNodeClick} onInsertLink={onInsertLink} idPrefix={idPrefix} />
                    ))}
                </div>
            )}
        </div>
    );
};

// --- COMPOSANT SPECIAL : ZONE RACINE ---
// Permet d'avoir plusieurs zones de drop qui pointent vers la racine
const RootDropZone = ({ id, label, className, children }: any) => {
    const { setNodeRef, isOver } = useDroppable({ id });
    return (
        <div
            ref={setNodeRef}
            className={`${className} ${isOver ? 'bg-amber-900/60 text-white border-amber-500 ring-2 ring-inset ring-amber-500/50 scale-[1.01] shadow-lg z-50' : ''}`}
        >
            {children ? children : (
                <>
                    <span className="text-lg">{isOver ? '📥' : '🏠'}</span>
                    {isOver ? "DÉPOSER ICI (RACINE)" : label}
                </>
            )}
        </div>
    );
};

// V11.90 : EN-TÊTE DU PANNEAU B (choix du dossier ciblé + zone de dépôt directe)
const PaneBHeader = ({ splitRoot, dirs, onSetSplitRoot }: any) => {
    const { setNodeRef, isOver } = useDroppable({ id: `B::${splitRoot}` });
    return (
        <div ref={setNodeRef} onClick={(e) => e.stopPropagation()} className={`px-2 py-2 flex items-center gap-2 bg-gray-900/80 border-b border-gray-800 transition-all shrink-0 ${isOver ? 'bg-amber-900/60 ring-2 ring-inset ring-amber-500/50' : ''}`}>
            <span className="text-amber-500 text-xs shrink-0" title="Déposer un fichier ici = le déplacer dans ce dossier">{isOver ? '📥' : '◫'}</span>
            <select value={splitRoot} onChange={(e) => onSetSplitRoot(e.target.value)} className="flex-1 min-w-0 bg-black border border-gray-700 text-gray-300 text-[10px] rounded px-1 py-1 focus:border-amber-500 outline-none">
                <option value="">🏠 RACINE (tout le coffre)</option>
                {dirs.map((d: string) => <option key={d} value={d}>{d}</option>)}
            </select>
        </div>
    );
};

const Sidebar: React.FC<SidebarProps> = ({
    fileTree, activeFile, selectedFolder, expandedFolders,
    onToggleExpand, onNodeClick, onDragEnd,
    onCreateFolder, onCreateNote, onFlashNote,
    onCloseVault, onInsertLink, onClearSelection,
    searchQuery, onSearch, searchResults,
    splitMode, onToggleSplit, splitRoot, onSetSplitRoot, expandedFoldersB, onToggleExpandB
}) => {

    // V10.42 FIX : Activation à 10px
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 10 } }));

    // V11.90 : données du split explorer
    const dirs = useMemo(() => collectDirs(fileTree).sort(), [fileTree]);
    const paneBNodes = useMemo(() => splitRoot ? (findChildren(fileTree, splitRoot) || fileTree) : fileTree, [fileTree, splitRoot]);

    return (
        <div className="flex flex-col h-full select-none bg-gray-950" onClick={onClearSelection}>
            <div className="p-4 border-b border-gray-700 flex flex-col gap-4 bg-black">
                <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500 text-sm">🔍</span>
                    <input
                        type="text" placeholder="Search..."
                        className="w-full bg-gray-900 border border-gray-600 text-gray-200 text-sm rounded-md py-1.5 pl-9 pr-8 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-all placeholder-gray-500"
                        value={searchQuery} onChange={(e) => onSearch(e.target.value)}
                    />
                    {searchQuery && (<button onClick={() => onSearch("")} className="absolute right-2 top-1.5 text-gray-500 hover:text-amber-500 text-xs font-bold h-full flex items-center transition-colors px-1">✕</button>)}
                </div>

                <div className="flex gap-2">
                    <button onClick={(e) => { e.stopPropagation(); onFlashNote(); }} className="flex-1 bg-amber-700 hover:bg-amber-600 text-white text-xs font-bold py-2 rounded flex items-center justify-center gap-2 shadow-lg transition-all border border-amber-500 hover:shadow-amber-900/30">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 !text-cyan-400 drop-shadow-md"><path fillRule="evenodd" d="M14.615 1.595a.75.75 0 01.359.852L12.981 9.75h3.75a.75.75 0 01.6 1.18l-7.5 10.5a.75.75 0 01-1.318-.994L10.744 14.25H7a.75.75 0 01-.6-1.18l7.5-10.5a.75.75 0 01.715-.975z" clipRule="evenodd" /></svg>
                        FLASH
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onCreateFolder(); }} className="bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-600 px-3 rounded transition-colors" title="New Folder">📁+</button>
                    <button onClick={(e) => { e.stopPropagation(); onCreateNote(); }} className="bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-600 px-3 rounded transition-colors" title="New Note">📝+</button>
                    <button onClick={(e) => { e.stopPropagation(); onToggleSplit(); }} className={`px-3 rounded border transition-colors ${splitMode ? 'bg-amber-900/40 border-amber-500 text-amber-400' : 'bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border-gray-600'}`} title="Vue double : 2 explorateurs pour ranger en glisser-déposer">◫</button>
                </div>
            </div>

            <div className="flex-1 min-h-0 flex flex-col relative bg-gray-950">
                {searchQuery.length >= 2 ? (
                    <div className="p-2 flex-1 overflow-y-auto custom-scrollbar">
                        <div className="text-[10px] font-bold text-amber-500 uppercase tracking-wider mb-2 px-2 border-b border-gray-800 pb-1">Résultats ({searchResults.length})</div>
                        {searchResults.map((node, index) => (
                            <SearchResultItem key={`${String(node.path)}-${index}`} node={node} onNodeClick={onNodeClick} />
                        ))}
                    </div>
                ) : (
                    // V10.42 : collisionDetection={pointerWithin} => LA CLÉ DE LA PRÉCISION
                    // V11.90 : un seul DndContext englobe les 2 panneaux => glisser-déposer entre eux
                    <DndContext onDragEnd={onDragEnd} sensors={sensors} collisionDetection={pointerWithin}>
                        <div className={`${splitMode ? 'flex-none h-1/2 border-b-2 border-amber-700/40' : 'flex-1'} min-h-0 overflow-y-auto custom-scrollbar`}>
                            <div className="min-h-full pb-10 flex flex-col">

                                {/* ZONE 1 : EN-TÊTE RACINE */}
                                <RootDropZone
                                    id="ROOT_TOP"
                                    label="VAULT ROOT"
                                    className="px-4 py-3 text-xs font-bold uppercase tracking-widest flex items-center gap-2 border-b border-gray-700 mb-1 transition-all text-amber-500 bg-gray-900/30"
                                />

                                {fileTree.map((node) => (
                                    <FileItem key={String(node.path)} node={node} level={0} activeFile={activeFile} selectedFolder={selectedFolder} expandedFolders={expandedFolders} onToggleExpand={onToggleExpand} onNodeClick={onNodeClick} onInsertLink={onInsertLink} />
                                ))}

                                {/* ZONE 2 : BAS DE PAGE RACINE (Immense zone pour faciliter le drop) */}
                                <RootDropZone
                                    id="ROOT_BOTTOM"
                                    className="flex-1 min-h-[150px] w-full flex items-center justify-center text-[10px] uppercase font-bold tracking-widest transition-colors text-transparent hover:text-amber-500/50"
                                >
                                    <span className="opacity-0 hover:opacity-100">DÉPOSER À LA RACINE</span>
                                </RootDropZone>
                            </div>
                        </div>

                        {/* V11.90 : PANNEAU B (vue double pour le rangement) */}
                        {splitMode && (
                            <div className="flex-1 min-h-0 flex flex-col bg-gray-950">
                                <PaneBHeader splitRoot={splitRoot} dirs={dirs} onSetSplitRoot={onSetSplitRoot} />
                                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pb-6">
                                    {paneBNodes.map((node) => (
                                        <FileItem key={`B::${String(node.path)}`} node={node} level={0} activeFile={activeFile} selectedFolder={selectedFolder} expandedFolders={expandedFoldersB} onToggleExpand={onToggleExpandB} onNodeClick={onNodeClick} onInsertLink={onInsertLink} idPrefix="B::" />
                                    ))}
                                    {paneBNodes.length === 0 && <div className="text-center text-gray-700 text-[10px] py-6 italic">Dossier vide — déposez des fichiers sur l'en-tête ci-dessus</div>}
                                </div>
                            </div>
                        )}
                    </DndContext>
                )}
            </div>
            <div className="p-2 border-t border-gray-800 bg-black flex justify-center">
                <button onClick={onCloseVault} className="text-[10px] text-gray-600 hover:text-red-500 uppercase tracking-widest font-bold transition-colors">Close Vault</button>
            </div>
        </div>
    );
};

export default Sidebar;