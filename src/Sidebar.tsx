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
}

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

const FileItem = ({ node, level, activeFile, selectedFolder, expandedFolders, onToggleExpand, onNodeClick, onInsertLink }: any) => {
    const nodeName = String(node.name || "");
    const nodePath = String(node.path || "");
    const isSelected = activeFile === nodePath || selectedFolder === nodePath;
    const [tooltip, setTooltip] = useState<{ x: number, y: number } | null>(null);

    // Config Drag & Drop
    const dndId = nodePath;
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
                        <FileItem key={String(child.path)} node={child} level={level + 1} activeFile={activeFile} selectedFolder={selectedFolder} expandedFolders={expandedFolders} onToggleExpand={onToggleExpand} onNodeClick={onNodeClick} onInsertLink={onInsertLink} />
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

const Sidebar: React.FC<SidebarProps> = ({
    fileTree, activeFile, selectedFolder, expandedFolders,
    onToggleExpand, onNodeClick, onDragEnd,
    onCreateFolder, onCreateNote, onFlashNote,
    onRename, onDelete, onCloseVault, onInsertLink, onClearSelection,
    searchQuery, onSearch, searchResults
}) => {

    // V10.42 FIX : Activation à 10px
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 10 } }));

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
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar relative bg-gray-950">
                {searchQuery.length >= 2 ? (
                    <div className="p-2">
                        <div className="text-[10px] font-bold text-amber-500 uppercase tracking-wider mb-2 px-2 border-b border-gray-800 pb-1">Résultats ({searchResults.length})</div>
                        {searchResults.map((node, index) => (
                            <SearchResultItem key={`${String(node.path)}-${index}`} node={node} onNodeClick={onNodeClick} />
                        ))}
                    </div>
                ) : (
                    // V10.42 : collisionDetection={pointerWithin} => LA CLÉ DE LA PRÉCISION
                    <DndContext onDragEnd={onDragEnd} sensors={sensors} collisionDetection={pointerWithin}>
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