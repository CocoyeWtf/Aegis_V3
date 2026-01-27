import React from 'react';
import {
    DndContext,
    DragEndEvent,
    useDraggable,
    useDroppable,
    useSensor,
    useSensors,
    MouseSensor,
    TouchSensor
} from '@dnd-kit/core';

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

    // V10.13 SEARCH PROPS
    searchQuery: string;
    onSearch: (query: string) => void;
    searchResults: FileNode[];
}

// --- COMPOSANTS (FileItem, FolderItem) ---
const FileItem = ({ node, activeFile, onNodeClick, onRename, depth, onInsertLink }: any) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: node.path });
    const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 999 } : undefined;

    return (
        <div ref={setNodeRef} style={style} {...listeners} {...attributes} className={`group flex items-center gap-2 py-1 px-2 cursor-pointer select-none text-xs hover:bg-gray-800 ${activeFile === node.path ? "bg-blue-900/40 text-blue-200 border-r-2 border-blue-500" : "text-gray-400"} ${isDragging ? "opacity-50" : ""}`} onClick={(e) => { e.stopPropagation(); onNodeClick(node); }} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onNodeClick(node); onRename(); }}>
            <span style={{ marginLeft: `${depth * 12}px` }} className="opacity-50 shrink-0">{node.extension === 'md' ? '📄' : '📦'}</span>
            <span className="truncate flex-1">{node.name}</span>
            {node.extension === 'md' && (<button onClick={(e) => { e.stopPropagation(); onInsertLink(node); }} className="opacity-0 group-hover:opacity-100 text-[9px] text-gray-500 hover:text-white bg-gray-700 px-1 rounded ml-auto">LINK</button>)}
        </div>
    );
};

const FolderItem = ({ node, activeFile, selectedFolder, expandedFolders, onToggleExpand, onNodeClick, onRename, children, depth }: any) => {
    const { setNodeRef: setDropRef, isOver } = useDroppable({ id: node.path });
    const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({ id: node.path });
    const isSelected = selectedFolder === node.path;
    const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 999 } : undefined;

    return (
        <div ref={setDropRef} className={`${isOver ? "bg-gray-800 ring-1 ring-blue-500" : ""}`}>
            <div ref={setDragRef} style={style} {...listeners} {...attributes} className={`group flex items-center gap-2 py-1 px-2 cursor-pointer select-none text-xs hover:bg-gray-800 ${isSelected ? "bg-gray-800 text-white font-bold" : "text-gray-400"} ${isDragging ? "opacity-50" : ""}`} onClick={(e) => { e.stopPropagation(); onNodeClick(node); }} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onNodeClick(node); onRename(); }}>
                <button onClick={(e) => { e.stopPropagation(); onToggleExpand(node.path); }} onPointerDown={(e) => e.stopPropagation()} className="p-0.5 hover:text-white w-4 text-center shrink-0" style={{ marginLeft: `${depth * 12}px` }}>{expandedFolders.has(node.path) ? '▼' : '▶'}</button>
                <span className="truncate flex-1 font-medium">{node.name}</span>
            </div>
            {expandedFolders.has(node.path) && <div>{children}</div>}
        </div>
    );
};

const renderTree = (nodes: FileNode[], props: any, depth = 0) => {
    return nodes.map((node) => {
        if (node.is_dir) {
            return <FolderItem key={node.path} node={node} depth={depth} {...props}>{renderTree(node.children, props, depth + 1)}</FolderItem>;
        } else {
            return <FileItem key={node.path} node={node} depth={depth} {...props} />;
        }
    });
};

const Sidebar = (props: SidebarProps) => {
    const { setNodeRef: setRootRef, isOver: isOverRoot } = useDroppable({ id: "ROOT_ZONE" });
    const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 5 } }), useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }));

    return (
        <div className="flex flex-col h-full w-full">
            <div className="p-2 bg-gray-950 border-b border-gray-900 shrink-0 flex flex-col gap-2">

                {/* V10.13: SEARCH INPUT */}
                <input
                    type="text"
                    placeholder="🔍 Search all notes..."
                    value={props.searchQuery}
                    onChange={(e) => props.onSearch(e.target.value)}
                    className="w-full bg-black border border-gray-800 text-gray-300 text-xs rounded px-2 py-1.5 focus:border-blue-600 focus:outline-none"
                />

                <div className="flex gap-2">
                    <button onClick={props.onFlashNote} className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-black font-bold py-1.5 px-2 rounded text-[10px] flex items-center justify-center gap-1">⚡ FLASH</button>
                    <button onClick={props.onCreateFolder} className="bg-gray-900 hover:bg-gray-800 text-gray-400 py-1.5 px-2 rounded text-[10px] border border-gray-800">📁+</button>
                    <button onClick={props.onCreateNote} className="bg-gray-900 hover:bg-gray-800 text-gray-400 py-1.5 px-2 rounded text-[10px] border border-gray-800">📄+</button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-2" onClick={props.onClearSelection}>
                {props.searchQuery.length > 1 ? (
                    // MODE RECHERCHE : Liste plate des résultats
                    <div className="flex flex-col gap-1">
                        <div className="text-[10px] text-gray-500 font-bold uppercase mb-2">Search Results ({props.searchResults.length})</div>
                        {props.searchResults.map(node => (
                            <div key={node.path} onClick={() => props.onNodeClick(node)} className={`flex items-center gap-2 py-1 px-2 cursor-pointer rounded hover:bg-gray-800 text-xs ${props.activeFile === node.path ? "bg-blue-900/30 text-blue-300" : "text-gray-400"}`}>
                                <span>📄</span>
                                <div className="flex flex-col overflow-hidden">
                                    <span className="truncate font-medium">{node.name}</span>
                                    <span className="truncate text-[9px] opacity-50">{node.path}</span>
                                </div>
                            </div>
                        ))}
                        {props.searchResults.length === 0 && <div className="text-center text-xs text-gray-600 mt-4">No match found.</div>}
                    </div>
                ) : (
                    // MODE ARBRE : File Explorer classique
                    <DndContext onDragEnd={props.onDragEnd} sensors={sensors}>
                        <div ref={setRootRef} className={`min-h-full pb-10 ${isOverRoot ? "bg-gray-900/30" : ""}`}>
                            {props.selectedFolder === "" && <div className="px-2 py-1 text-[10px] text-blue-500 font-bold uppercase tracking-wider mb-2 border-b border-blue-900/30">🏠 VAULT ROOT</div>}
                            {renderTree(props.fileTree, props)}
                        </div>
                    </DndContext>
                )}
            </div>

            <div className="p-2 border-t border-gray-900 shrink-0">
                <button onClick={props.onCloseVault} className="w-full text-[10px] text-gray-600 hover:text-red-500 py-2 uppercase tracking-widest transition-colors">CLOSE VAULT</button>
            </div>
        </div>
    );
};

export default Sidebar;