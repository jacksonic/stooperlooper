import React, { useState } from 'react';
import { ProjectState } from '../types';
import { AudioEngine } from '../audio/AudioEngine';
import { encodeAudioBufferToMp3, encodeAudioBufferToWav } from '../audio/mp3Export';
import { Download, X, Check, Loader2, Music, Layers, HardDrive } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  project: ProjectState;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, project, onClose }) => {
  const [format, setFormat] = useState<'mp3' | 'wav'>('mp3');
  const [bitrate, setBitrate] = useState<number>(320); // 320 kbps high quality default
  const [scope, setScope] = useState<'loop' | 'full'>('loop');
  const [filename, setFilename] = useState<string>('my-4track-loop');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [exportStatusText, setExportStatusText] = useState<string>('');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadFileName, setDownloadFileName] = useState<string>('');

  if (!isOpen) return null;

  const handleStartExport = async () => {
    setIsExporting(true);
    setExportProgress(0.1);
    setExportStatusText('Rendering multitrack mixdown...');

    try {
      const engine = AudioEngine.getInstance();
      const renderedBuffer = await engine.renderProjectOffline(project, scope);

      setExportProgress(0.4);
      let blob: Blob;
      let finalName = `${filename || '4track-project'}-${Date.now()}`;

      if (format === 'mp3') {
        setExportStatusText(`Encoding high-quality MP3 (${bitrate} kbps)...`);
        blob = await encodeAudioBufferToMp3(renderedBuffer, bitrate, (prog) => {
          setExportProgress(0.4 + prog * 0.55);
        });
        finalName += '.mp3';
      } else {
        setExportStatusText('Encoding lossless 16-bit PCM WAV...');
        setExportProgress(0.85);
        blob = encodeAudioBufferToWav(renderedBuffer);
        finalName += '.wav';
      }

      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setDownloadFileName(finalName);
      setExportProgress(1.0);
      setExportStatusText('Export complete! Click below to download.');

      // Auto trigger download
      const a = document.createElement('a');
      a.href = url;
      a.download = finalName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      console.error('Export failed:', err);
      setExportStatusText(`Export failed: ${err?.message || 'Please check console.'}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Export individual track stems
  const handleExportStems = async () => {
    setIsExporting(true);
    setExportStatusText('Exporting track stems...');

    try {
      const engine = AudioEngine.getInstance();
      for (const track of project.tracks) {
        if (!track.clip) continue;

        setExportStatusText(`Exporting Track ${track.id} (${track.name})...`);
        const singleTrackProject: ProjectState = {
          ...project,
          tracks: project.tracks.map((t) => ({
            ...t,
            muted: t.id !== track.id,
            soloed: false,
          })),
        };

        const rendered = await engine.renderProjectOffline(singleTrackProject, scope);
        const blob = await encodeAudioBufferToMp3(rendered, bitrate);
        const url = URL.createObjectURL(blob);
        const name = `${filename}-Track${track.id}-${track.name.replace(/\s+/g, '_')}.mp3`;

        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        await new Promise((r) => setTimeout(r, 400));
      }

      setExportStatusText('All track stems downloaded successfully!');
    } catch (err: any) {
      console.error('Stem export failed:', err);
      setExportStatusText(`Stem export failed: ${err?.message || 'Please check console.'}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl p-6 relative flex flex-col gap-5 text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Export Project Audio</h2>
              <p className="text-xs text-slate-400">Save your multi-track mixdown in studio quality</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Export Form */}
        <div className="flex flex-col gap-4">
          {/* Filename */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-300">File Name</label>
            <input
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="my-4track-loop"
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:border-amber-500 outline-none"
            />
          </div>

          {/* Format Selection: MP3 vs WAV */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setFormat('mp3')}
              className={`p-3 rounded-lg border text-left flex flex-col gap-1 transition ${
                format === 'mp3'
                  ? 'bg-amber-500/10 border-amber-500 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-400'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-100">MP3 Format</span>
                {format === 'mp3' && <Check className="w-4 h-4 text-amber-400" />}
              </div>
              <span className="text-[11px] text-slate-400">High-quality compressed audio file</span>
            </button>

            <button
              type="button"
              onClick={() => setFormat('wav')}
              className={`p-3 rounded-lg border text-left flex flex-col gap-1 transition ${
                format === 'wav'
                  ? 'bg-amber-500/10 border-amber-500 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-400'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-100">WAV Format</span>
                {format === 'wav' && <Check className="w-4 h-4 text-amber-400" />}
              </div>
              <span className="text-[11px] text-slate-400">Lossless 16-bit 44.1kHz studio master</span>
            </button>
          </div>

          {/* MP3 Bitrate Options */}
          {format === 'mp3' && (
            <div className="flex flex-col gap-1.5 bg-slate-950/50 p-3 rounded-lg border border-slate-800">
              <label className="text-xs font-semibold text-slate-300">MP3 Bitrate (Quality)</label>
              <div className="grid grid-cols-4 gap-2">
                {[128, 192, 256, 320].map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => setBitrate(rate)}
                    className={`py-1.5 px-2 rounded text-xs font-semibold border transition ${
                      bitrate === rate
                        ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    {rate} kbps
                    {rate === 320 && <span className="block text-[9px] opacity-80">Max</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Export Scope */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-300">Export Scope</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setScope('loop')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold border text-left transition ${
                  scope === 'loop'
                    ? 'bg-slate-800 border-amber-500 text-slate-100'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div>Loop Region Only</div>
                <div className="text-[10px] text-slate-400">
                  {project.loopStart.toFixed(1)}s to {project.loopEnd.toFixed(1)}s ({(project.loopEnd - project.loopStart).toFixed(1)}s)
                </div>
              </button>

              <button
                type="button"
                onClick={() => setScope('full')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold border text-left transition ${
                  scope === 'full'
                    ? 'bg-slate-800 border-amber-500 text-slate-100'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div>Full Timeline</div>
                <div className="text-[10px] text-slate-400">All recorded clips from 0:00 to end</div>
              </button>
            </div>
          </div>

          {/* Progress / Status feedback */}
          {exportStatusText && (
            <div className="flex flex-col gap-1.5 bg-slate-950/70 p-3 rounded-lg border border-slate-800">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300">{exportStatusText}</span>
                <span className="text-amber-400 font-mono font-bold">
                  {Math.round(exportProgress * 100)}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 transition-all duration-150"
                  style={{ width: `${exportProgress * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-4">
          <button
            type="button"
            disabled={isExporting}
            onClick={handleExportStems}
            title="Download each individual track as a separate audio file"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 disabled:opacity-50 transition"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Export Stems</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              Cancel
            </button>

            <button
              id="start-export-button"
              type="button"
              disabled={isExporting}
              onClick={handleStartExport}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.3)] disabled:opacity-50 transition active:scale-95"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Export {format.toUpperCase()}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
