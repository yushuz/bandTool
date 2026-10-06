export type Tool = 'home' | 'tuner' | 'metronome' | 'songs' | 'recordings';

export type SongStatus = 'new' | 'practicing' | 'ready';

export interface Song {
  id: string;
  title: string;
  key: string;
  bpm: number;
  beats: number;
  beatUnit: number;
  tuning: string;
  notes: string;
  status: SongStatus;
}

export interface StoredRecording {
  id: string;
  songId: string;
  title: string;
  createdAt: number;
  duration: number;
  mimeType: string;
  blob: Blob;
}

export const defaultSongs: Song[] = [
  {
    id: 'summer-night',
    title: '夏夜晚风',
    key: 'Em',
    bpm: 92,
    beats: 4,
    beatUnit: 4,
    tuning: '标准',
    notes: '鼓四拍起。第二遍副歌收住动态，尾奏看鼓手。',
    status: 'practicing',
  },
  {
    id: 'highway-song',
    title: '西湖',
    key: 'F',
    bpm: 85,
    beats: 4,
    beatUnit: 4,
    tuning: '降半音',
    notes: '痛仰版本。注意间奏高把位和弦与推弦，动态保持舒展。',
    status: 'practicing',
  },
  {
    id: 'after-rain',
    title: '我用什么把你留住',
    key: 'A♭',
    bpm: 62,
    beats: 4,
    beatUnit: 4,
    tuning: '标准',
    notes: 'G 调指法，变调夹 1 品。副歌注意层次递进，保持慢拍稳定。',
    status: 'new',
  },
];

export const tuningPresets: Record<string, { label: string; midi: number }[]> = {
  标准: [
    { label: 'E2', midi: 40 },
    { label: 'A2', midi: 45 },
    { label: 'D3', midi: 50 },
    { label: 'G3', midi: 55 },
    { label: 'B3', midi: 59 },
    { label: 'E4', midi: 64 },
  ],
  'Drop D': [
    { label: 'D2', midi: 38 },
    { label: 'A2', midi: 45 },
    { label: 'D3', midi: 50 },
    { label: 'G3', midi: 55 },
    { label: 'B3', midi: 59 },
    { label: 'E4', midi: 64 },
  ],
  降半音: [
    { label: 'D♯2', midi: 39 },
    { label: 'G♯2', midi: 44 },
    { label: 'C♯3', midi: 49 },
    { label: 'F♯3', midi: 54 },
    { label: 'A♯3', midi: 58 },
    { label: 'D♯4', midi: 63 },
  ],
};
