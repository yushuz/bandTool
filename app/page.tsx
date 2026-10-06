'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { detectPitch, frequencyForMidi, noteFromPitch } from './audio';
import { listRecordings, removeRecording, saveRecording } from './storage';
import { defaultSongs, tuningPresets, type Song, type StoredRecording, type Tool } from './types';

const navItems: { id: Tool; label: string; symbol: string }[] = [
  { id: 'home', label: '排练', symbol: '●' },
  { id: 'tuner', label: '调音', symbol: '⌁' },
  { id: 'metronome', label: '节拍', symbol: '▲' },
  { id: 'songs', label: '曲目', symbol: '≡' },
  { id: 'recordings', label: '录音', symbol: '■' },
];

const statusLabels = { new: '新曲', practicing: '排练中', ready: '已就绪' };

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function PageHeader({ title, kicker, action }: { title: string; kicker: string; action?: React.ReactNode }) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{kicker}</p>
        <h1>{title}</h1>
      </div>
      {action}
    </div>
  );
}

export default function Home() {
  const [welcomeOpen, setWelcomeOpen] = useState(true);
  const [welcomeLeaving, setWelcomeLeaving] = useState(false);
  const [active, setActive] = useState<Tool>('home');
  const [songs, setSongs] = useState<Song[]>(defaultSongs);
  const [currentSongId, setCurrentSongId] = useState(defaultSongs[0].id);
  const [a4, setA4] = useState(440);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [songFormOpen, setSongFormOpen] = useState(false);
  const [rehearsalMode, setRehearsalMode] = useState(false);
  const [toast, setToast] = useState('');
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const savedSongs = localStorage.getItem('backbeat:songs');
      const savedCurrent = localStorage.getItem('backbeat:current-song');
      const savedA4 = localStorage.getItem('backbeat:a4');
      if (savedSongs) setSongs(JSON.parse(savedSongs) as Song[]);
      if (savedCurrent) setCurrentSongId(savedCurrent);
      if (savedA4) setA4(Number(savedA4));
      navigator.serviceWorker?.register('/sw.js').catch(() => undefined);
    } catch {
      setToast('本地数据读取失败，已使用默认曲目');
    }
  }, []);

  useEffect(() => localStorage.setItem('backbeat:songs', JSON.stringify(songs)), [songs]);
  useEffect(() => localStorage.setItem('backbeat:current-song', currentSongId), [currentSongId]);
  useEffect(() => localStorage.setItem('backbeat:a4', String(a4)), [a4]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const currentSong = songs.find((song) => song.id === currentSongId) ?? songs[0] ?? defaultSongs[0];
  const nextSong = songs[(Math.max(0, songs.findIndex((song) => song.id === currentSong.id)) + 1) % songs.length] ?? currentSong;

  function enterApp() {
    setWelcomeLeaving(true);
    window.setTimeout(() => setWelcomeOpen(false), 520);
  }

  function chooseTool(tool: Tool) {
    setActive(tool);
    setRehearsalMode(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function exportBackup() {
    const payload = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), a4, currentSongId, songs }, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `backbeat-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setToast('曲目与设置已导出');
  }

  async function importBackup(file: File) {
    try {
      const parsed = JSON.parse(await file.text()) as { songs?: Song[]; a4?: number; currentSongId?: string };
      if (!Array.isArray(parsed.songs) || !parsed.songs.length) throw new Error('invalid');
      setSongs(parsed.songs);
      if (parsed.a4) setA4(parsed.a4);
      if (parsed.currentSongId) setCurrentSongId(parsed.currentSongId);
      setToast('备份已恢复');
      setSettingsOpen(false);
    } catch {
      setToast('无法读取这个备份文件');
    }
  }

  if (welcomeOpen) return <WelcomeScreen leaving={welcomeLeaving} onEnter={enterApp} />;

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => chooseTool('home')} aria-label="回到排练首页">
          <span className="brand-mark" aria-hidden="true">B</span>
          <span className="brand-copy"><strong>Backbeat</strong><small>个人排练台</small></span>
        </button>
        <div className="header-context">
          <span>{currentSong.title}</span>
          <i />
          <span>{currentSong.bpm} BPM</span>
        </div>
        <button className="avatar-button" onClick={() => setSettingsOpen(true)} aria-label="打开设置">LF</button>
      </header>

      <section className={`workspace workspace--${active}`}>
        {active === 'home' && (
          <Dashboard
            currentSong={currentSong}
            nextSong={nextSong}
            onTool={chooseTool}
            onStart={() => setRehearsalMode(true)}
            onSongs={() => chooseTool('songs')}
          />
        )}
        {active === 'tuner' && <Tuner a4={a4} song={currentSong} />}
        {active === 'metronome' && <Metronome song={currentSong} />}
        {active === 'songs' && (
          <Songs
            songs={songs}
            currentSongId={currentSong.id}
            onCurrent={(id) => { setCurrentSongId(id); setToast('已设为当前曲目'); }}
            onAdd={() => setSongFormOpen(true)}
            onDelete={(id) => {
              if (songs.length <= 1) return setToast('至少保留一首曲目');
              const remaining = songs.filter((song) => song.id !== id);
              setSongs(remaining);
              if (id === currentSong.id) setCurrentSongId(remaining[0].id);
            }}
          />
        )}
        {active === 'recordings' && <Recordings song={currentSong} songs={songs} onToast={setToast} />}
      </section>

      <nav className="bottom-nav" aria-label="主要导航">
        {navItems.map((item) => (
          <button key={item.id} className={active === item.id ? 'active' : ''} onClick={() => chooseTool(item.id)} aria-current={active === item.id ? 'page' : undefined}>
            <span aria-hidden="true">{item.symbol}</span>{item.label}
          </button>
        ))}
      </nav>

      {settingsOpen && (
        <div className="modal-layer" role="presentation" onMouseDown={() => setSettingsOpen(false)}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="settings-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setSettingsOpen(false)} aria-label="关闭">×</button>
            <p className="eyebrow">本机设置</p>
            <h2 id="settings-title">你的排练台</h2>
            <label className="range-field">
              <span><b>A4 基准频率</b><output>{a4} Hz</output></span>
              <input type="range" min="430" max="450" value={a4} onChange={(event) => setA4(Number(event.target.value))} />
            </label>
            <div className="data-card">
              <div><strong>数据只在这台设备</strong><p>曲目保存在浏览器中，录音不会上传。</p></div>
              <span className="offline-dot" />
            </div>
            <div className="modal-actions">
              <button className="secondary-button" onClick={exportBackup}>导出备份</button>
              <button className="secondary-button" onClick={() => importRef.current?.click()}>恢复备份</button>
              <input ref={importRef} hidden type="file" accept="application/json" onChange={(event) => event.target.files?.[0] && importBackup(event.target.files[0])} />
            </div>
          </section>
        </div>
      )}

      {songFormOpen && <SongForm onClose={() => setSongFormOpen(false)} onSave={(song) => { setSongs((items) => [...items, song]); setCurrentSongId(song.id); setSongFormOpen(false); setToast('曲目已加入'); }} />}
      {rehearsalMode && <RehearsalMode song={currentSong} nextSong={nextSong} onClose={() => setRehearsalMode(false)} onTool={chooseTool} onNext={() => setCurrentSongId(nextSong.id)} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}

function WelcomeScreen({ leaving, onEnter }: { leaving: boolean; onEnter: () => void }) {
  return (
    <main className={`welcome-screen ${leaving ? 'is-leaving' : ''}`}>
      <header className="welcome-header">
        <div className="welcome-brand" aria-label="Backbeat 个人排练台">
          <span className="welcome-brand__mark" aria-hidden="true">B</span>
          <span><strong>Backbeat</strong><small>个人排练台</small></span>
        </div>
        <span className="welcome-status"><i /> 本机离线可用</span>
      </header>

      <section className="welcome-stage">
        <div className="welcome-copy">
          <p className="welcome-kicker">YOUR PRIVATE REHEARSAL ROOM</p>
          <h1>先听见自己，<br />再一起出发。</h1>
          <p className="welcome-intro">调好音，找准拍，把今晚的灵感留在这里。</p>
          <div className="welcome-notes" aria-label="应用特点">
            <span>无需账号</span><span>无需联网</span><span>数据不上传</span>
          </div>
        </div>

        <aside className="welcome-card" aria-labelledby="welcome-title">
          <div className="welcome-card__pulse" aria-hidden="true"><i /><i /><i /><b>92</b></div>
          <p>WELCOME BACK</p>
          <h2 id="welcome-title">今晚，<br />开始排练。</h2>
          <div className="welcome-card__rule" />
          <p className="welcome-card__detail">没有登录，也没有云端账户。<br />这就是属于你的排练台。</p>
          <button type="button" onClick={onEnter}>进入排练台 <span>→</span></button>
          <small>点击进入即在当前设备开始使用</small>
        </aside>
      </section>

      <footer className="welcome-footer">
        <span>01 · TUNE</span><span>02 · KEEP TIME</span><span>03 · RECORD</span>
      </footer>
    </main>
  );
}

function Dashboard({ currentSong, nextSong, onTool, onStart, onSongs }: { currentSong: Song; nextSong: Song; onTool: (tool: Tool) => void; onStart: () => void; onSongs: () => void }) {
  return (
    <>
      <div className="intro-row">
        <div><p className="eyebrow">今晚排练</p><h1>让每一拍，<br />都落在一起。</h1></div>
        <p className="offline-badge"><span /> 本机离线</p>
      </div>
      <article className="now-card">
        <div className="now-card__copy">
          <p className="eyebrow eyebrow--light">当前曲目 · 01</p>
          <h2>{currentSong.title}</h2>
          <div className="song-stats" aria-label="歌曲参数">
            <span><b>{currentSong.bpm}</b> BPM</span><span><b>{currentSong.beats}/{currentSong.beatUnit}</b> 拍号</span>
            <span><b>{currentSong.key}</b> 调性</span><span><b>{currentSong.tuning}</b> 调弦</span>
          </div>
        </div>
        <div className="pulse-art" aria-hidden="true"><span className="pulse pulse--one" /><span className="pulse pulse--two" /><span className="pulse pulse--three" /><span className="pulse-core">{currentSong.bpm}</span></div>
        <button className="start-button" onClick={onStart}>开始排练 <span>→</span></button>
      </article>
      <div className="section-heading"><div><p className="eyebrow">快速工具</p><h2>现在需要什么？</h2></div><button className="text-button" onClick={onSongs}>编辑曲目单</button></div>
      <div className="tool-grid">
        <button className="tool-card tool-card--tuner" onClick={() => onTool('tuner')}><span className="tool-icon" aria-hidden="true">⌁</span><span className="tool-title">快速调音</span><span className="tool-caption">{currentSong.tuning} · A4 440Hz</span><span className="tool-link">打开调音器 →</span></button>
        <button className="tool-card tool-card--metro" onClick={() => onTool('metronome')}><span className="tool-icon" aria-hidden="true">▲</span><span className="tool-title">节拍器</span><span className="tool-caption">{currentSong.bpm} BPM · {currentSong.beats}/{currentSong.beatUnit}</span><span className="tool-link">开始打拍 →</span></button>
        <button className="tool-card tool-card--record" onClick={() => onTool('recordings')}><span className="record-dot" aria-hidden="true" /><span className="tool-title">排练录音</span><span className="tool-caption">自动关联当前曲目</span><span className="tool-link">开始录音 →</span></button>
      </div>
      <article className="next-song"><div className="track-number">02</div><div className="track-copy"><span>下一首</span><strong>{nextSong.title}</strong></div><div className="track-meta"><span>{nextSong.bpm} BPM</span><span>{nextSong.key}</span><span>{nextSong.beats}/{nextSong.beatUnit}</span></div><button aria-label="打开下一首" onClick={onSongs}>→</button></article>
    </>
  );
}

function Tuner({ a4, song }: { a4: number; song: Song }) {
  const [listening, setListening] = useState(false);
  const [pitch, setPitch] = useState(-1);
  const [error, setError] = useState('');
  const [selectedMidi, setSelectedMidi] = useState(40);
  const audioRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastReadRef = useRef(0);
  const notes = tuningPresets[song.tuning] ?? tuningPresets['标准'];
  const detected = pitch > 0 ? noteFromPitch(pitch, a4) : null;
  const selected = notes.find((note) => note.midi === selectedMidi) ?? notes[0];
  const targetFrequency = frequencyForMidi(selected.midi, a4);
  const displayCents = detected ? Math.max(-50, Math.min(50, detected.cents)) : 0;

  const stop = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    void audioRef.current?.close();
    frameRef.current = null; streamRef.current = null; audioRef.current = null;
    setListening(false); setPitch(-1);
  }, []);

  useEffect(() => stop, [stop]);
  useEffect(() => { setSelectedMidi(notes[0].midi); }, [song.tuning]);

  async function start() {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 4096;
      context.createMediaStreamSource(stream).connect(analyser);
      const buffer = new Float32Array(analyser.fftSize);
      streamRef.current = stream; audioRef.current = context; setListening(true);
      const read = (time: number) => {
        if (time - lastReadRef.current > 85) {
          analyser.getFloatTimeDomainData(buffer);
          setPitch(detectPitch(buffer, context.sampleRate));
          lastReadRef.current = time;
        }
        frameRef.current = requestAnimationFrame(read);
      };
      frameRef.current = requestAnimationFrame(read);
    } catch {
      setError('无法使用麦克风，请在浏览器设置中允许访问。');
    }
  }

  return (
    <div className="tool-page">
      <PageHeader kicker={`${song.title} · ${song.tuning}`} title="调音器" action={<span className="micro-label">A4 · {a4} Hz</span>} />
      <section className={`tuner-stage ${listening ? 'is-live' : ''}`}>
        <div className="tuner-scale" aria-hidden="true"><span>-50</span><i /><i /><i /><i /><b>0</b><i /><i /><i /><i /><span>+50</span></div>
        <div className="tuner-needle" style={{ transform: `translateX(-50%) rotate(${displayCents * 1.1}deg)` }} />
        <div className="pitch-readout">
          <span className="note-name">{detected ? detected.name : selected.label.replace(/[0-9]/g, '')}</span>
          <sup>{detected ? detected.octave : selected.label.match(/[0-9]/)?.[0]}</sup>
          <p>{detected ? `${pitch.toFixed(1)} Hz` : `目标 ${targetFrequency.toFixed(1)} Hz`}</p>
        </div>
        <div className={`tuning-status ${detected && Math.abs(detected.cents) <= 4 ? 'in-tune' : ''}`}>
          {!listening ? '准备聆听' : !detected ? '请弹响一根弦' : Math.abs(detected.cents) <= 4 ? '音准正确' : detected.cents < 0 ? `偏低 ${Math.abs(detected.cents)} 音分` : `偏高 ${detected.cents} 音分`}
        </div>
        <button className={`round-control ${listening ? 'stop' : ''}`} onClick={listening ? stop : start}>{listening ? '停止' : '开始'}</button>
        {error && <p className="inline-error">{error}</p>}
      </section>
      <section className="string-panel"><div><p className="eyebrow">目标琴弦</p><strong>{song.tuning}调弦</strong></div><div className="string-buttons">{notes.map((note) => <button key={note.midi} className={selectedMidi === note.midi ? 'active' : ''} onClick={() => setSelectedMidi(note.midi)}>{note.label}</button>)}</div></section>
      <p className="tool-hint">在安静环境中逐根拨弦；手机靠近音箱或琴体，读数会更稳定。</p>
    </div>
  );
}

function Metronome({ song }: { song: Song }) {
  const [bpm, setBpm] = useState(song.bpm);
  const [beats, setBeats] = useState(song.beats);
  const [subdivision, setSubdivision] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [visualBeat, setVisualBeat] = useState(-1);
  const audioRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);
  const nextTimeRef = useRef(0);
  const tickRef = useRef(0);
  const tapsRef = useRef<number[]>([]);
  const bpmRef = useRef(bpm);
  const beatsRef = useRef(beats);
  const subdivisionRef = useRef(subdivision);

  useEffect(() => { setBpm(song.bpm); setBeats(song.beats); }, [song.id, song.bpm, song.beats]);
  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
  useEffect(() => { beatsRef.current = beats; }, [beats]);
  useEffect(() => { subdivisionRef.current = subdivision; }, [subdivision]);

  const stop = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    void audioRef.current?.close(); audioRef.current = null;
    setPlaying(false); setVisualBeat(-1); tickRef.current = 0;
  }, []);
  useEffect(() => stop, [stop]);

  function scheduleClick(context: AudioContext, time: number, tick: number) {
    const sub = subdivisionRef.current;
    const mainBeat = tick % sub === 0;
    const beat = Math.floor(tick / sub);
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = !mainBeat ? 440 : beat === 0 ? 1280 : 820;
    gain.gain.setValueAtTime(mainBeat ? 0.34 : 0.11, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.035);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(time); oscillator.stop(time + 0.04);
    const delay = Math.max(0, (time - context.currentTime) * 1000);
    window.setTimeout(() => setVisualBeat(beat), delay);
  }

  function start() {
    const context = new AudioContext();
    audioRef.current = context; nextTimeRef.current = context.currentTime + 0.08; tickRef.current = 0; setPlaying(true);
    timerRef.current = window.setInterval(() => {
      while (nextTimeRef.current < context.currentTime + 0.12) {
        scheduleClick(context, nextTimeRef.current, tickRef.current);
        nextTimeRef.current += 60 / bpmRef.current / subdivisionRef.current;
        tickRef.current = (tickRef.current + 1) % (beatsRef.current * subdivisionRef.current);
      }
    }, 25);
  }

  function tap() {
    const now = performance.now();
    const recent = [...tapsRef.current.filter((value) => now - value < 2200), now].slice(-7);
    tapsRef.current = recent;
    if (recent.length > 1) {
      const intervals = recent.slice(1).map((value, index) => value - recent[index]);
      setBpm(Math.max(30, Math.min(240, Math.round(60000 / (intervals.reduce((a, b) => a + b, 0) / intervals.length)))));
    }
  }

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || ['INPUT', 'BUTTON'].includes((event.target as HTMLElement).tagName)) return;
      event.preventDefault(); playing ? stop() : start();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });

  return (
    <div className="tool-page">
      <PageHeader kicker={`${song.title} · ${beats}/${song.beatUnit}`} title="节拍器" action={<button className="tap-button" onClick={tap}>TAP</button>} />
      <section className={`metronome-stage ${playing ? 'is-playing' : ''}`}>
        <div className="beat-dots">{Array.from({ length: beats }).map((_, index) => <span key={index} className={visualBeat === index ? 'active' : ''}>{index + 1}</span>)}</div>
        <div className="bpm-control"><button onClick={() => setBpm((value) => Math.max(30, value - 1))} aria-label="减慢一拍">−</button><div><strong>{bpm}</strong><span>BPM</span></div><button onClick={() => setBpm((value) => Math.min(240, value + 1))} aria-label="加快一拍">＋</button></div>
        <input className="tempo-range" aria-label="速度" type="range" min="30" max="240" value={bpm} onChange={(event) => setBpm(Number(event.target.value))} />
        <button className={`play-control ${playing ? 'pause' : ''}`} onClick={playing ? stop : start}><span aria-hidden="true" />{playing ? '停止节拍' : '开始节拍'}</button>
      </section>
      <div className="control-grid">
        <section className="option-card"><p className="eyebrow">拍号</p><div className="segmented">{[2, 3, 4, 6].map((value) => <button key={value} className={beats === value ? 'active' : ''} onClick={() => setBeats(value)}>{value}/{value === 6 ? 8 : 4}</button>)}</div></section>
        <section className="option-card"><p className="eyebrow">细分</p><div className="segmented">{[{ value: 1, label: '四分' }, { value: 2, label: '八分' }, { value: 3, label: '三连' }, { value: 4, label: '十六' }].map((item) => <button key={item.value} className={subdivision === item.value ? 'active' : ''} onClick={() => setSubdivision(item.value)}>{item.label}</button>)}</div></section>
      </div>
      <p className="tool-hint">节拍由音频时钟提前排程，页面轻微卡顿时也不会漂移。空格键可开始或停止。</p>
    </div>
  );
}

function Songs({ songs, currentSongId, onCurrent, onAdd, onDelete }: { songs: Song[]; currentSongId: string; onCurrent: (id: string) => void; onAdd: () => void; onDelete: (id: string) => void }) {
  return (
    <div className="tool-page">
      <PageHeader kicker={`${songs.length} 首曲目 · 保存在本机`} title="曲目单" action={<button className="primary-button" onClick={onAdd}>＋ 新曲目</button>} />
      <div className="songs-list">
        {songs.map((song, index) => (
          <article className={`song-row ${currentSongId === song.id ? 'current' : ''}`} key={song.id}>
            <span className="song-index">{String(index + 1).padStart(2, '0')}</span>
            <div className="song-main"><div><h2>{song.title}</h2>{currentSongId === song.id && <em>当前</em>}</div><p>{song.notes || '还没有排练备注'}</p></div>
            <div className="song-pills"><span>{song.bpm} BPM</span><span>{song.key}</span><span>{song.beats}/{song.beatUnit}</span><span>{song.tuning}</span></div>
            <div className="song-status"><i className={`status-${song.status}`} />{statusLabels[song.status]}</div>
            <div className="row-actions"><button onClick={() => onCurrent(song.id)}>设为当前</button><button className="danger-link" onClick={() => onDelete(song.id)} aria-label={`删除${song.title}`}>删除</button></div>
          </article>
        ))}
      </div>
    </div>
  );
}

function SongForm({ onClose, onSave }: { onClose: () => void; onSave: (song: Song) => void }) {
  const [title, setTitle] = useState(''); const [key, setKey] = useState('C'); const [bpm, setBpm] = useState(120); const [beats, setBeats] = useState(4); const [tuning, setTuning] = useState('标准'); const [notes, setNotes] = useState('');
  function submit(event: FormEvent) { event.preventDefault(); if (!title.trim()) return; onSave({ id: crypto.randomUUID(), title: title.trim(), key, bpm, beats, beatUnit: beats === 6 ? 8 : 4, tuning, notes: notes.trim(), status: 'new' }); }
  return (
    <div className="modal-layer" role="presentation" onMouseDown={onClose}><form className="modal song-form" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}><button type="button" className="modal-close" onClick={onClose} aria-label="关闭">×</button><p className="eyebrow">曲目资料</p><h2>加入一首歌</h2><label className="field field--wide"><span>歌名</span><input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：没有理想的人不伤心" required /></label><div className="form-grid"><label className="field"><span>调性</span><input value={key} onChange={(event) => setKey(event.target.value)} /></label><label className="field"><span>BPM</span><input type="number" min="30" max="240" value={bpm} onChange={(event) => setBpm(Number(event.target.value))} /></label><label className="field"><span>拍号</span><select value={beats} onChange={(event) => setBeats(Number(event.target.value))}><option value="2">2/4</option><option value="3">3/4</option><option value="4">4/4</option><option value="6">6/8</option></select></label><label className="field"><span>调弦</span><select value={tuning} onChange={(event) => setTuning(event.target.value)}>{Object.keys(tuningPresets).map((preset) => <option key={preset}>{preset}</option>)}</select></label></div><label className="field field--wide"><span>排练备注</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="起拍、结构、需要注意的段落……" /></label><button className="primary-button form-submit" type="submit">保存并设为当前</button></form></div>
  );
}

function Recordings({ song, songs, onToast }: { song: Song; songs: Song[]; onToast: (message: string) => void }) {
  const [recordings, setRecordings] = useState<StoredRecording[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedRef = useRef(0);
  const clockRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    try { setRecordings(await listRecordings()); } catch { setError('无法读取本地录音。'); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const next: Record<string, string> = {};
    recordings.forEach((item) => { next[item.id] = URL.createObjectURL(item.blob); });
    setUrls(next);
    return () => Object.values(next).forEach(URL.revokeObjectURL);
  }, [recordings]);
  useEffect(() => () => { if (clockRef.current) window.clearInterval(clockRef.current); streamRef.current?.getTracks().forEach((track) => track.stop()); }, []);

  async function startRecording() {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferred = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : '';
      const mediaRecorder = new MediaRecorder(stream, preferred ? { mimeType: preferred } : undefined);
      streamRef.current = stream; recorderRef.current = mediaRecorder; chunksRef.current = []; startedRef.current = Date.now(); setElapsed(0);
      mediaRecorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      mediaRecorder.onstop = async () => {
        const duration = Math.max(1, Math.round((Date.now() - startedRef.current) / 1000));
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
        await saveRecording({ id: crypto.randomUUID(), songId: song.id, title: `${song.title} · 排练录音`, createdAt: Date.now(), duration, mimeType: blob.type, blob });
        stream.getTracks().forEach((track) => track.stop());
        await refresh(); onToast('录音已保存在本机');
      };
      mediaRecorder.start(500); setRecording(true);
      clockRef.current = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedRef.current) / 1000)), 250);
    } catch { setError('无法开始录音，请允许麦克风访问。'); }
  }

  function stopRecording() {
    recorderRef.current?.stop(); setRecording(false);
    if (clockRef.current) window.clearInterval(clockRef.current); clockRef.current = null;
  }

  async function deleteRecording(id: string) { await removeRecording(id); await refresh(); onToast('录音已删除'); }

  return (
    <div className="tool-page">
      <PageHeader kicker={`当前关联 · ${song.title}`} title="排练录音" action={<span className="micro-label">仅保存在本机</span>} />
      <section className={`record-stage ${recording ? 'is-recording' : ''}`}><div className="record-rings"><span /><span /><button onClick={recording ? stopRecording : startRecording} aria-label={recording ? '停止录音' : '开始录音'}><i /></button></div><div><p>{recording ? '正在录音' : '准备录音'}</p><strong>{formatDuration(elapsed)}</strong><span>{recording ? song.title : '点击红色按钮开始'}</span></div></section>
      {error && <p className="inline-error">{error}</p>}
      <div className="section-heading section-heading--compact"><div><p className="eyebrow">历史记录</p><h2>{recordings.length ? `${recordings.length} 段录音` : '还没有录音'}</h2></div></div>
      <div className="recording-list">
        {recordings.map((item) => {
          const linkedSong = songs.find((entry) => entry.id === item.songId);
          return <article className="recording-row" key={item.id}><span className="mini-wave" aria-hidden="true"><i /><i /><i /><i /><i /></span><div><strong>{item.title}</strong><p>{new Date(item.createdAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · {formatDuration(item.duration)} · {linkedSong?.title ?? '未关联曲目'}</p></div>{urls[item.id] && <audio controls preload="metadata" src={urls[item.id]} />}<div className="row-actions"><a href={urls[item.id]} download={`${item.title}.webm`}>导出</a><button className="danger-link" onClick={() => deleteRecording(item.id)}>删除</button></div></article>;
        })}
        {!recordings.length && <div className="empty-state"><span>●</span><p>第一段排练录音会出现在这里。<br />录音不会离开你的设备。</p></div>}
      </div>
    </div>
  );
}

function RehearsalMode({ song, nextSong, onClose, onTool, onNext }: { song: Song; nextSong: Song; onClose: () => void; onTool: (tool: Tool) => void; onNext: () => void }) {
  return (
    <section className="rehearsal-overlay" aria-label="排练模式"><header><div className="brand"><span className="brand-mark">B</span><span className="brand-copy"><strong>排练模式</strong><small>保持屏幕常亮</small></span></div><button onClick={onClose}>退出 ×</button></header><div className="rehearsal-body"><p className="eyebrow eyebrow--light">正在排练</p><h1>{song.title}</h1><div className="rehearsal-stats"><span><b>{song.bpm}</b><small>BPM</small></span><span><b>{song.beats}/{song.beatUnit}</b><small>拍号</small></span><span><b>{song.key}</b><small>调性</small></span><span><b>{song.tuning}</b><small>调弦</small></span></div><p className="rehearsal-note">{song.notes}</p><div className="rehearsal-actions"><button onClick={() => onTool('tuner')}>⌁ 调音</button><button className="accent" onClick={() => onTool('metronome')}>▲ 启动节拍</button><button onClick={() => onTool('recordings')}>● 录音</button></div></div><footer><span>下一首 · {nextSong.title}</span><button onClick={onNext}>切换下一首 →</button></footer></section>
  );
}
