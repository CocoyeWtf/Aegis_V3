import React from 'react';
import {
    DndContext,
    DragEndEvent,
    useDraggable,
    useDroppable,
    useSensor,
    useSensors,
    PointerSensor
} from "@dnd-kit/core";

export interface FileNode {
    path: string;
    name: string;
    is_dir: boolean;
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
}

// Composant pour rendre la racine "Droppable" (Déposable)
const RootDroppable = ({ children, isSelected, onClick }: any) => {
    const { setNodeRef, isOver } = useDroppable({ id: "ROOT_ZONE" });
    return (
        <div
            ref={setNodeRef}
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className={`px-2 py-2 mb-2 rounded text-xs font-bold cursor-pointer flex items-center gap-2 border border-dashed transition-colors 
        ${isOver ? "bg-green-900/40 border-green-500 text-green-300 scale-[1.02]" : ""}
        ${isSelected ? "bg-blue-900/20 border-blue-500 text-blue-300" : "border-gray-800 text-gray-500 hover:text-gray-300 hover:border-gray-600"}
      `}
        >
            <span>🏠</span> VAULT ROOT (Racine)
            {children}
        </div>
    );
};

const SidebarNode = ({ node, activeFile, selectedFolder, expandedFolders, onToggleExpand, onNodeClick, onInsertLink }: any) => {
    const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({ id: node.path });
    const { setNodeRef: setDropRef, isOver } = useDroppable({ id: node.path, disabled: !node.is_dir });

    const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 9999, position: 'relative' as 'relative' } : undefined;
    const depth = node.path.split('/').length - 1;
    const isExpanded = expandedFolders.has(node.path);

    // Correction de la logique de sélection visuelle
    const isSelected = activeFile === node.path || (node.is_dir && selectedFolder === node.path);

    return (
        <div
            ref={(el) => { setDragRef(el); if (node.is_dir) setDropRef(el); }}
            style={{ ...style, paddingLeft: `${depth * 12 + 8}px` }}
            {...listeners} {...attributes}
            className={`group/node py-1.5 rounded text-sm flex items-center gap-2 truncate transition-colors border border-transparent 
        ${isSelected ? "bg-blue-900/30 text-white border-blue-900" : "text-gray-400 hover:bg-gray-900"}
        ${isOver && node.is_dir ? "bg-purple-900/60 border-purple-500 scale-[1.02] shadow-lg shadow-purple-900/50" : ""}
        ${isDragging ? "opacity-30 bg-gray-800" : ""}
      `}
        >
            {node.is_dir ? (
                <span onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onToggleExpand(node.path); }} className="w-4 text-center hover:text-white font-bold text-[10px] cursor-pointer">{isExpanded ? '▼' : '▶'}</span>
            ) : <span className="w-4"></span>}

            <span onClick={() => onNodeClick(node)} className="truncate flex-1 flex items-center gap-2 cursor-pointer">
                <span className="opacity-70 text-xs">{node.is_dir ? '📁' : '📝'}</span>
                {node.name}
            </span>

            {!node.is_dir && (
                <button onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onInsertLink(node); }} className="opacity-0 group-hover/node:opacity-100 bg-blue-900 hover:bg-blue-600 text-white px-1.5 rounded text-[10px] mr-1 transition-opacity border border-blue-700">🔗</button>
            )}
        </div>
    );
};

const Sidebar: React.FC<SidebarProps> = (props) => {
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 10 } }));
    const isVisibleInTree = (nodePath: string) => { const parts = nodePath.split('/'); let currentPath = parts[0]; for (let i = 0; i < parts.length - 1; i++) { if (!props.expandedFolders.has(currentPath)) return false; currentPath += `/${parts[i + 1]}`; } return true; };

    return (
        <div className="w-64 bg-gray-950 border-r border-gray-900 flex flex-col font-sans select-none">
            <div className="p-3 border-b border-gray-900 flex flex-col gap-2 bg-gray-950 shadow-sm z-10">
                <button onClick={props.onFlashNote} className="w-full bg-yellow-600/90 hover:bg-yellow-500 text-white border border-yellow-700 py-2 rounded text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-yellow-900/20 transition-all hover:scale-[1.02]">
                    <span>⚡</span> FLASH NOTE
                </button>
                <div className="grid grid-cols-2 gap-2 mt-1">
                    <button onClick={props.onCreateFolder} className="bg-gray-900 hover:bg-gray-800 text-gray-300 border border-gray-800 py-1.5 rounded text-[10px] font-bold flex items-center justify-center gap-1 transition-colors" title={props.selectedFolder ? `DANS : ${props.selectedFolder}` : "A LA RACINE"}>
                        <span>📁+</span> {props.selectedFolder ? "SUB" : "ROOT"}
                    </button>
                    <button onClick={props.onCreateNote} className="bg-gray-900 hover:bg-gray-800 text-gray-300 border border-gray-800 py-1.5 rounded text-[10px] font-bold flex items-center justify-center gap-1 transition-colors" title={props.selectedFolder ? `DANS : ${props.selectedFolder}` : "DANS INBOX"}>
                        <span>📝+</span> {props.selectedFolder ? "HERE" : "INBOX"}
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
                <DndContext onDragEnd={props.onDragEnd} sensors={sensors}>
                    {/* ZONE RACINE (Drop & Click) */}
                    <RootDroppable isSelected={props.selectedFolder === ""} onClick={props.onClearSelection} />

                    {props.fileTree.map((node) => {
                        if (!isVisibleInTree(node.path)) return null;
                        return <SidebarNode key={node.path} node={node} activeFile={props.activeFile} selectedFolder={props.selectedFolder} expandedFolders={props.expandedFolders} onToggleExpand={props.onToggleExpand} onNodeClick={props.onNodeClick} onInsertLink={props.onInsertLink} />;
                    })}
                </DndContext>
                <div className="h-full min-h-[50px] cursor-default" onClick={props.onClearSelection} title="Cliquer ici pour désélectionner"></div>
            </div>

            <div className="p-2 border-t border-gray-900 mt-auto flex flex-col gap-2 bg-gray-950 z-10">
                {(props.selectedFolder || props.activeFile) && (
                    <div className="flex gap-1 animate-pulse-once">
                        <button onClick={props.onRename} className="flex-1 bg-blue-900/20 hover:bg-blue-900/40 text-blue-400 border border-blue-900/50 py-1 rounded text-[10px] font-bold transition-colors">RENAME</button>
                        <button onClick={props.onDelete} className="flex-1 bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/50 py-1 rounded text-[10px] font-bold transition-colors">DELETE</button>
                    </div>
                )}
                <button onClick={props.onCloseVault} className="flex items-center justify-center gap-2 w-full text-gray-600 hover:text-white text-[10px] py-1 rounded transition-colors hover:bg-gray-900">CLOSE VAULT</button>
            </div>
        </div>
    );
};
export default Sidebar;