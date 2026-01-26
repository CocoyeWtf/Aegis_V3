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
    onDeleteFolder: () => void;
    onCloseVault: () => void;
    onInsertLink: (node: FileNode) => void; // Nouvelle action
}

const SidebarNode = ({ node, activeFile, selectedFolder, expandedFolders, onToggleExpand, onNodeClick, onInsertLink }: any) => {
    const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({ id: node.path });
    const { setNodeRef: setDropRef, isOver } = useDroppable({ id: node.path, disabled: !node.is_dir });

    const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 9999, position: 'relative' as 'relative' } : undefined;
    const depth = node.path.split('/').length - 1;
    const isExpanded = expandedFolders.has(node.path);

    return (
        <div
            ref={(el) => { setDragRef(el); if (node.is_dir) setDropRef(el); }}
            style={{ ...style, paddingLeft: `${depth * 12 + 8}px` }}
            {...listeners} {...attributes}
            className={`group/node py-1.5 rounded text-sm flex items-center gap-2 truncate transition-colors border border-transparent 
        ${activeFile === node.path ? "bg-blue-900/30 text-white border-blue-900" : ""} 
        ${isOver && node.is_dir ? "bg-purple-900/60 border-purple-500 scale-[1.02] shadow-lg shadow-purple-900/50" : ""}
        ${!isOver && selectedFolder === node.path && node.is_dir ? "bg-yellow-900/20 text-yellow-100 border-yellow-900/50" : ""}
        ${!isOver && activeFile !== node.path && selectedFolder !== node.path ? "text-gray-400 hover:bg-gray-900" : ""}
        ${isDragging ? "opacity-30 bg-gray-800" : ""}
      `}
        >
            {node.is_dir ? (
                <span
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); onToggleExpand(node.path); }}
                    className="w-4 text-center hover:text-white font-bold text-[10px] cursor-pointer"
                >
                    {isExpanded ? '▼' : '▶'}
                </span>
            ) : <span className="w-4"></span>}

            <span onClick={() => onNodeClick(node)} className="truncate flex-1 flex items-center gap-2 cursor-pointer">
                <span className="opacity-70 text-xs">{node.is_dir ? '📁' : '📝'}</span>
                {node.name}
            </span>

            {/* BOUTON MAGIQUE D'INSERTION DE LIEN (Visible au survol) */}
            {!node.is_dir && (
                <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); onInsertLink(node); }}
                    className="opacity-0 group-hover/node:opacity-100 bg-blue-900 hover:bg-blue-600 text-white px-1.5 rounded text-[10px] mr-1 transition-opacity border border-blue-700"
                    title="Insérer un lien vers cette note"
                >
                    🔗
                </button>
            )}
        </div>
    );
};

const Sidebar: React.FC<SidebarProps> = (props) => {
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 10 } })
    );

    const isVisibleInTree = (nodePath: string) => {
        const parts = nodePath.split('/');
        let currentPath = parts[0];
        for (let i = 0; i < parts.length - 1; i++) {
            if (!props.expandedFolders.has(currentPath)) return false;
            currentPath += `/${parts[i + 1]}`;
        }
        return true;
    };

    return (
        <div className="w-64 bg-gray-950 border-r border-gray-900 flex flex-col">
            <div className="p-3 grid grid-cols-2 gap-2">
                <button onClick={props.onCreateFolder} className="bg-yellow-900/20 hover:bg-yellow-900/40 text-yellow-500 border border-yellow-900/50 py-2 rounded text-xs font-bold flex items-center justify-center gap-1"><span>📁</span>+</button>
                <button onClick={props.onCreateNote} className="bg-green-900/20 hover:bg-green-900/40 text-green-400 border border-green-900/50 py-2 rounded text-xs font-bold flex items-center justify-center gap-1"><span>📝</span>+</button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 select-none">
                <DndContext onDragEnd={props.onDragEnd} sensors={sensors}>
                    {props.fileTree.map((node) => {
                        if (!isVisibleInTree(node.path)) return null;
                        return (
                            <SidebarNode
                                key={node.path}
                                node={node}
                                activeFile={props.activeFile}
                                selectedFolder={props.selectedFolder}
                                expandedFolders={props.expandedFolders}
                                onToggleExpand={props.onToggleExpand}
                                onNodeClick={props.onNodeClick}
                                onInsertLink={props.onInsertLink} // Passage de la fonction
                            />
                        );
                    })}
                </DndContext>
            </div>

            <div className="p-2 border-t border-gray-900 mt-auto flex flex-col gap-2">
                {props.selectedFolder && !props.activeFile && (
                    <div className="bg-red-950/20 p-2 rounded mb-2">
                        <p className="text-[10px] text-red-400 mb-1 px-1">Selected: {props.selectedFolder}</p>
                        <button onClick={props.onDeleteFolder} className="w-full bg-red-900/50 hover:bg-red-800 text-white text-xs py-1 rounded font-bold border border-red-700">DELETE FOLDER</button>
                    </div>
                )}
                <button onClick={props.onCloseVault} className="flex items-center justify-center gap-2 w-full bg-gray-900 hover:bg-gray-800 text-gray-500 hover:text-white text-xs py-2 rounded transition-colors border border-transparent hover:border-gray-700">
                    <span>⏻</span> CLOSE VAULT
                </button>
            </div>
        </div>
    );
};

export default Sidebar;