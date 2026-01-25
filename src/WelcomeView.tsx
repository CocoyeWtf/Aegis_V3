import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';

interface WelcomeViewProps {
    onVaultSelected: (path: string) => void;
}

export default function WelcomeView({ onVaultSelected }: WelcomeViewProps) {
    const [error, setError] = useState<string>("");

    const handleCreate = async () => {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
                title: "Sélectionner l'emplacement du nouveau Cockpit"
            });

            if (selected && typeof selected === 'string') {
                const name = prompt("Nom du nouveau Cockpit (Dossier) :");
                if (!name) return;

                const fullPath = `${selected}\\${name}`; // Simple concatenation for Windows
                await invoke("create_vault_directory", { path: fullPath });
                onVaultSelected(fullPath);
            }
        } catch (err) {
            setError("Erreur création: " + err);
        }
    };

    const handleOpen = async () => {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
                title: "Ouvrir un Cockpit existant"
            });

            if (selected && typeof selected === 'string') {
                onVaultSelected(selected);
            }
        } catch (err) {
            setError("Erreur ouverture: " + err);
        }
    };

    return (
        <div className="h-screen w-screen bg-black text-white flex flex-col items-center justify-center font-sans select-none relative overflow-hidden">
            {/* Background decorations */}
            <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                <div className="absolute top-[20%] left-[10%] w-96 h-96 bg-purple-900 rounded-full blur-[120px]"></div>
                <div className="absolute bottom-[20%] right-[10%] w-96 h-96 bg-blue-900 rounded-full blur-[120px]"></div>
            </div>

            <div className="z-10 flex flex-col items-center gap-12">
                <div className="text-center">
                    <div className="text-8xl mb-4 opacity-80 animate-pulse">◈</div>
                    <h1 className="text-5xl font-bold tracking-[0.2em] mb-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">AEGIS</h1>
                    <p className="text-gray-500 text-sm tracking-widest uppercase">System V4.2 // Neural Interface</p>
                </div>

                <div className="flex gap-8">
                    <button
                        onClick={handleCreate}
                        className="group w-64 h-40 bg-gray-900/40 border border-gray-800 rounded-xl hover:bg-gray-900/80 hover:border-purple-500/50 transition-all duration-300 flex flex-col items-center justify-center gap-4 hover:scale-105 hover:shadow-[0_0_30px_rgba(168,85,247,0.15)]"
                    >
                        <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center group-hover:bg-purple-900/30 group-hover:text-purple-400 transition-colors">
                            <span className="text-2xl">+</span>
                        </div>
                        <div className="text-center">
                            <div className="font-bold text-gray-300 group-hover:text-purple-300">NOUVEAU COCKPIT</div>
                            <div className="text-[10px] text-gray-600 mt-1 uppercase tracking-wider">Initialiser un Vault</div>
                        </div>
                    </button>

                    <button
                        onClick={handleOpen}
                        className="group w-64 h-40 bg-gray-900/40 border border-gray-800 rounded-xl hover:bg-gray-900/80 hover:border-blue-500/50 transition-all duration-300 flex flex-col items-center justify-center gap-4 hover:scale-105 hover:shadow-[0_0_30px_rgba(59,130,246,0.15)]"
                    >
                        <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center group-hover:bg-blue-900/30 group-hover:text-blue-400 transition-colors">
                            <span className="text-xl">📂</span>
                        </div>
                        <div className="text-center">
                            <div className="font-bold text-gray-300 group-hover:text-blue-300">OUVRIR COCKPIT</div>
                            <div className="text-[10px] text-gray-600 mt-1 uppercase tracking-wider">Charger un dossier</div>
                        </div>
                    </button>
                </div>

                {error && (
                    <div className="bg-red-900/20 border border-red-900/50 text-red-400 px-6 py-3 rounded text-xs font-mono">
                        ⚠ {error}
                    </div>
                )}
            </div>

            <div className="absolute bottom-8 text-[10px] text-gray-700 font-mono">
                SECURE VAULT ACCESS PROTOCOL
            </div>
        </div>
    );
}
