import React from 'react';
import { DndContext, DragEndEvent, useDraggable, useDroppable } from '@dnd-kit/core';

// --- TYPES ---
export interface FileNode {
    name: String;
    path: String;
    is_dir: boolean;
    children: FileNode[];
    extension: String;
    content: String;
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

const FileItem = ({ node, level, activeFile, selectedFolder, expandedFolders, onToggleExpand, onNodeClick, onInsertLink }: any) => {
    const isSelected = activeFile === node.path || selectedFolder === node.path;

    // Drag & Drop Hooks
    const { attributes, listeners, setNodeRef: setDragRef, transform } = useDraggable({
        id: node.path,
    });
    const { setNodeRef: setDropRef, isOver } = useDroppable({
        id: node.path,
        data: { isFolder: node.is_dir }
    });

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 999,
        opacity: 0.8
    } : undefined;

    const setRefs = (element: HTMLElement | null) => {
        setDragRef(element);
        if (node.is_dir) setDropRef(element);
    };

    return (
        <div style={style}>
            <div
                ref={setRefs}
                {...attributes}
                {...listeners}
                className={`
                    flex items-center gap-2 py-1 px-2 cursor-pointer select-none text-xs transition-colors
                    ${isSelected ? 'bg-amber-900/30 text-amber-100 border-l-2 border-amber-500' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-900'}
                    ${isOver && node.is_dir ? 'bg-amber-800/50 ring-1 ring-amber-500' : ''}
                `}
                style={{ paddingLeft: `${level * 12 + 8}px` }}
                onClick={(e) => {
                    e.stopPropagation();
                    onNodeClick(node);
                }}
            >
                {/* FLÈCHE D'EXPANSION (GOLD FIXED - NO EMOJI) */}
                {node.is_dir ? (
                    <span
                        onPointerDown={(e) => e.stopPropagation()} // Stop Drag
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleExpand(node.path);
                        }}
                        // Utilisation de text-amber-500 forcé et caractères géométriques
                        className="w-5 h-5 flex items-center justify-center text-amber-500 hover:text-amber-300 hover:bg-gray-800 rounded transition-colors font-bold text-[10px]"
                        title="Développer/Réduire"
                    >
                        {/* Utilisation de ▸ et ▾ au lieu de ▶ et ▼ pour éviter le rendu Emoji bleu Windows */}
                        {expandedFolders.has(node.path) ? '▾' : '▸'}
                    </span>
                ) : (
                    <span className="w-5"></span>
                )}

                {/* ICÔNE TYPE */}
                <span className={`text-[10px] ${node.is_dir ? 'text-amber-600' : 'text-gray-500'}`}>
                    {node.is_dir ? '📁' : node.extension === 'md' ? '📝' : '📄'}
                </span>

                {/* NOM DU FICHIER */}
                <span className="truncate flex-1">{node.name}</span>

                {/* LIEN RAPIDE */}
                {!node.is_dir && node.extension === 'md' && (
                    <button
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); onInsertLink(node); }}
                        className="opacity-0 group-hover:opacity-100 text-[9px] text-gray-500 hover:text-amber-400 px-1"
                        title="Insérer lien vers cette note"
                    >
                        🔗
                    </button>
                )}
            </div>

            {/* ENFANTS */}
            {node.is_dir && expandedFolders.has(node.path) && (
                <div>
                    {node.children.map((child: any) => (
                        <FileItem
                            key={child.path}
                            node={child}
                            level={level + 1}
                            activeFile={activeFile}
                            selectedFolder={selectedFolder}
                            expandedFolders={expandedFolders}
                            onToggleExpand={onToggleExpand}
                            onNodeClick={onNodeClick}
                            onInsertLink={onInsertLink}
                        />
                    ))}
                </div>
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

    const { setNodeRef: setRootDropRef, isOver: isOverRoot } = useDroppable({ id: "ROOT_ZONE" });

    return (
        <div className="flex flex-col h-full select-none" onClick={onClearSelection}>
            {/* --- HEADER ACTIONS --- */}
            <div className="p-3 border-b border-gray-900 flex flex-col gap-3 bg-gray-950">
                {/* Search Bar Gold & Clear Button */}
                <div className="relative">
                    <span className="absolute left-2 top-1.5 text-gray-600 text-xs">🔍</span>
                    <input
                        type="text"
                        placeholder="Search all notes..."
                        className="w-full bg-black border border-gray-800 text-gray-300 text-xs rounded py-1 pl-7 pr-7 focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-900 transition-all placeholder-gray-700"
                        value={searchQuery}
                        onChange={(e) => onSearch(e.target.value)}
                    />
                    {/* BOUTON CROIX */}
                    {searchQuery && (
                        <button
                            onClick={() => onSearch("")}
                            className="absolute right-2 top-1 text-gray-600 hover:text-amber-500 text-[10px] font-bold h-full flex items-center transition-colors px-1"
                            title="Effacer la recherche"
                        >
                            ✕
                        </button>
                    )}
                </div>

                {/* Action Buttons Gold */}
                <div className="flex gap-1">
                    <button onClick={(e) => { e.stopPropagation(); onFlashNote(); }} className="flex-1 bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-bold py-1.5 rounded flex items-center justify-center gap-1 shadow-sm transition-colors border border-amber-500">
                        <span>⚡</span> FLASH
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onCreateFolder(); }} className="bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-amber-200 border border-gray-800 px-2 rounded transition-colors" title="New Folder">
                        📁+
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onCreateNote(); }} className="bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-amber-200 border border-gray-800 px-2 rounded transition-colors" title="New Note">
                        📝+
                    </button>
                </div>
            </div>

            {/* --- TREE / SEARCH RESULTS --- */}
            <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                {searchQuery.length >= 2 ? (
                    // RESULTATS RECHERCHE
                    <div className="p-2">
                        <div className="text-[10px] font-bold text-amber-500 uppercase tracking-wider mb-2 px-2">
                            Résultats ({searchResults.length})
                        </div>
                        {searchResults.map(node => (
                            <div
                                key={node.path as string}
                                onClick={(e) => { e.stopPropagation(); onNodeClick(node); }}
                                className="flex items-center gap-2 py-1.5 px-2 cursor-pointer hover:bg-gray-900 rounded group"
                            >
                                <span className="text-xs">📝</span>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-xs text-gray-300 group-hover:text-white truncate font-medium">
                                        {node.name}
                                    </span>
                                    <span className="text-[9px] text-gray-600 truncate">
                                        {node.path}
                                    </span>
                                </div>
                            </div>
                        ))}
                        {searchResults.length === 0 && (
                            <div className="text-center text-gray-700 text-xs mt-4 italic">Aucun résultat</div>
                        )}
                    </div>
                ) : (
                    // ARBRE FICHIERS
                    <DndContext onDragEnd={onDragEnd}>
                        <div
                            ref={setRootDropRef}
                            className={`min-h-full pb-10 ${isOverRoot ? 'bg-amber-900/10' : ''}`}
                        >
                            {/* Root Label Gold */}
                            <div className="px-3 py-2 text-[10px] font-bold text-amber-700/50 uppercase tracking-widest flex items-center gap-2">
                                <span>🏠</span> VAULT ROOT
                            </div>

                            {fileTree.map((node) => (
                                <FileItem
                                    key={node.path}
                                    node={node}
                                    level={0}
                                    activeFile={activeFile}
                                    selectedFolder={selectedFolder}
                                    expandedFolders={expandedFolders}
                                    onToggleExpand={onToggleExpand}
                                    onNodeClick={onNodeClick}
                                    onInsertLink={onInsertLink}
                                />
                            ))}
                        </div>
                    </DndContext>
                )}
            </div>

            {/* --- FOOTER --- */}
            <div className="p-2 border-t border-gray-900 bg-black flex justify-center">
                <button
                    onClick={onCloseVault}
                    className="text-[9px] text-gray-600 hover:text-red-500 uppercase tracking-widest font-bold transition-colors"
                >
                    Close Vault
                </button>
            </div>
        </div>
    );
};

export default Sidebar;