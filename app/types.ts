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
    title: '公路之歌',
    key: 'G',
    bpm: 128,
    beats: 4,
    beatUnit: 4,
    tuning: '标准',
    notes: '前奏吉他两遍，主歌进人声。',
    status: 'ready',
  },
  {
    id: 'after-rain',
    title: '雨后',
    key: 'D',
    bpm: 76,
    beats: 6,
    beatUnit: 8,
    tuning: 'Drop D',
    notes: '6/8 拍，注意副歌不要抢拍。',
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
