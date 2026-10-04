import { useCallback, useEffect, useState } from 'react';
import { Eye } from 'lucide-react';
import type { AudioEngine } from './audio/AudioEngine';
import { DropOverlay } from './components/DropOverlay';
import { SceneSwitcher } from './components/SceneSwitcher';
import { SettingsPanel } from './components/SettingsPanel';
import { SourcePanel } from './components/SourcePanel';
import { StartOverlay } from './components/StartOverlay';
import { Toast } from './components/Toast';
import { TopBar } from './components/TopBar';
import { TransportBar } from './components/TransportBar';
import { PALETTE_LIST, PALETTES } from './config/palettes';
import { DEFAULT_SETTINGS, SCENES, type SceneId, type VisualizerSettings } from './config/settings';
import { useAudioEngine, useEngineSnapshot } from './hooks/useAudioEngine';
import { useFileDrop } from './hooks/useFileDrop';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { usePersistentState } from './hooks/usePersistentState';
import { SceneRoot } from './scenes/SceneRoot';

export default function App() {
  const engine = useAudioEngine();
  // The engine is created in an effect; render the dark backdrop for that single frame.
  if (!engine) return <div className="h-full bg-[#04030b]" />;
  return <Studio engine={engine} />;
}

/** Guards against stale/invalid values restored from localStorage. */
function sanitize(settings: VisualizerSettings): VisualizerSettings {
  return {
    ...settings,
    scene: SCENES.some((s) => s.id === settings.scene) ? settings.scene : DEFAULT_SETTINGS.scene,
    palette: settings.palette in PALETTES ? settings.palette : DEFAULT_SETTINGS.palette,
  };
}

function Studio({ engine }: { engine: AudioEngine }) {
  const snapshot = useEngineSnapshot(engine);
  const [storedSettings, setSettings] = usePersistentState<VisualizerSettings>('neuroaudio:settings', DEFAULT_SETTINGS);
  const settings = sanitize(storedSettings);
  const palette = PALETTES[settings.palette];

  const [started, setStarted] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [uiVisible, setUiVisible] = useState(true);
  const [fps, setFps] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const updateSettings = useCallback(
    (patch: Partial<VisualizerSettings>) => setSettings((prev) => ({ ...prev, ...patch })),
    [setSettings],
  );

  useEffect(() => {
    engine.sensitivity = settings.bassSensitivity;
  }, [engine, settings.bassSensitivity]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement !== null);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // --- audio source actions (all invoked from user gestures → autoplay-policy safe)
  const startSynth = useCallback(() => {
    setStarted(true);
    void engine.playSynth();
  }, [engine]);

  const startFile = useCallback(
    (file: File) => {
      setStarted(true);
      void engine.loadFile(file);
    },
    [engine],
  );

  const startMic = useCallback(() => {
    void engine.startMic().then(() => {
      if (engine.getSnapshot().source === 'mic') setStarted(true);
    });
  }, [engine]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => undefined);
  }, []);

  const setScene = (scene: SceneId) => updateSettings({ scene });

  const isDragging = useFileDrop(startFile);

  useKeyboardShortcuts({
    Space: () => (started ? void engine.togglePlay() : startSynth()),
    Digit1: () => setScene('sphere'),
    Digit2: () => setScene('terrain'),
    Digit3: () => setScene('tunnel'),
    Numpad1: () => setScene('sphere'),
    Numpad2: () => setScene('terrain'),
    Numpad3: () => setScene('tunnel'),
    KeyP: () => {
      const index = PALETTE_LIST.findIndex((p) => p.id === settings.palette);
      updateSettings({ palette: PALETTE_LIST[(index + 1) % PALETTE_LIST.length].id });
    },
    KeyS: () => setSettingsOpen((open) => !open),
    KeyH: () => setUiVisible((visible) => !visible),
    KeyF: toggleFullscreen,
    Escape: () => setSettingsOpen(false),
  });

  const dismissError = useCallback(() => engine.clearError(), [engine]);

  return (
    <div
      className="relative h-full w-full"
      style={{ '--accent-a': palette.primary, '--accent-b': palette.secondary, '--accent-c': palette.accent }}
    >
      <SceneRoot engine={engine} settings={settings} onFps={setFps} />

      {uiVisible ? (
        <div className="pointer-events-none fixed inset-0 z-10 flex flex-col">
          <TopBar
            fps={fps}
            contextState={snapshot.contextState}
            settingsOpen={settingsOpen}
            isFullscreen={isFullscreen}
            onToggleSettings={() => setSettingsOpen((open) => !open)}
            onToggleFullscreen={toggleFullscreen}
            onHideUi={() => setUiVisible(false)}
          />

          <div className="min-h-0 flex-1 px-4 sm:px-5">
            <div className="hidden md:block">
              <SourcePanel source={snapshot.source} onSynth={startSynth} onFile={startFile} onMic={startMic} />
            </div>
          </div>

          <div className="flex justify-center px-4 pb-3">
            <SceneSwitcher scene={settings.scene} onChange={setScene} />
          </div>

          <div className="mx-auto w-full max-w-5xl px-4 pb-4 sm:px-5 sm:pb-5">
            <TransportBar engine={engine} snapshot={snapshot} palette={palette} />
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setUiVisible(true)}
          className="glass fixed right-4 bottom-4 z-10 flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-white/60 opacity-40 transition hover:text-white hover:opacity-100"
        >
          <Eye className="h-4 w-4" />
          Mostrar interfaz (H)
        </button>
      )}

      <SettingsPanel
        open={settingsOpen && uiVisible}
        settings={settings}
        onChange={updateSettings}
        onReset={() => setSettings(DEFAULT_SETTINGS)}
        onClose={() => setSettingsOpen(false)}
      />

      {!started && <StartOverlay onSynth={startSynth} onFile={startFile} onMic={startMic} />}
      {isDragging && <DropOverlay />}
      {snapshot.error && <Toast message={snapshot.error} onDismiss={dismissError} />}
    </div>
  );
}
