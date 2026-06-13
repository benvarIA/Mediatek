import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

export type ItemType = 'music' | 'video';
export type Support = 'cd' | 'vinyl' | 'dvd' | 'bluray';
export type State = 'neuf' | 'bon_etat' | 'use';

export interface Item {
  id: number;
  type: ItemType;
  support: Support;
  title: string;
  year: number | null;
  genres: string[];
  cover_url: string | null;
  artist_or_director: string | null;
  notes: string;
  state: State;
  // music
  label?: string | null;
  tracklist?: Track[];
  duration_total_sec?: number | null;
  vinyl_format?: string | null;
  // video
  synopsis?: string | null;
  duration_min?: number | null;
  cast_list?: string[];
  language?: string | null;
  subtitles?: string | null;
  extras?: string | null;
  // enrichissement disque (Discogs)
  catalog_no?: string | null;
  country?: string | null;
  styles?: string[];
  barcode?: string | null;
  original_year?: number | null;
  format_detail?: string | null;
  credits?: Credit[];
  community?: Community | null;
  videos?: Video[];
  description?: string | null;
  artist_bio?: string | null;
  discogs_id?: number | null;
  back_cover_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Track {
  position: number;
  title: string;
  length_sec: number | null;
}

export interface Credit {
  role: string;
  names: string[];
}

export interface Community {
  have: number | null;
  want: number | null;
  rating: number | null;
  rating_count: number | null;
  lowest_price: number | null;
  num_for_sale: number | null;
}

export interface Video {
  title: string;
  url: string;
  duration: number | null;
}

export interface MusicEditorialCredit {
  role: string;
  names: string[];
}

export interface MusicEditorialRating {
  source: string;
  label: string;
  value: number;
  scale: number;
  count: number | null;
  url: string | null;
}

export interface MusicEditorialFact {
  text: string;
  source: string;
  url?: string | null;
}

export interface MusicEditorialSource {
  label: string;
  url: string;
}

export interface MusicEditorial {
  album_summary: string | null;
  artist_summary: string | null;
  main_credits: MusicEditorialCredit[];
  rating: MusicEditorialRating | null;
  anecdotes: MusicEditorialFact[];
  sources: MusicEditorialSource[];
  lastfm_context: {
    listeners: string | null;
    release_date: string | null;
    length: string | null;
    tags: string[];
  } | null;
}

export type MusicEditorialSourceKey = 'discogs' | 'musicbrainz' | 'lastfm' | 'wikipedia' | 'theaudiodb';
export type VideoEnrichmentSourceKey = 'tmdb';
export type EnrichmentSourceKey = MusicEditorialSourceKey | VideoEnrichmentSourceKey;

export interface ItemFilters {
  type?: string;
  support?: string;
  genre?: string;
  decade?: number;
  state?: string;
  search?: string;
  sort?: 'title' | 'year' | 'added';
}

export const itemsApi = {
  list: (filters: ItemFilters = {}) => {
    const params: any = { ...filters };
    return api.get<Item[]>('/items', { params }).then(r => r.data);
  },
  get: (id: number) => api.get<Item>(`/items/${id}`).then(r => r.data),
  create: (data: Partial<Item>) => api.post<Item>('/items', data).then(r => r.data),
  update: (id: number, data: Partial<Item>) => api.put<Item>(`/items/${id}`, data).then(r => r.data),
  reEnrich: (id: number, options: { sources: EnrichmentSourceKey[]; updateImage: boolean }) =>
    api.post<Item>(`/items/${id}/re-enrich`, options).then(r => r.data),
  uploadCover: (id: number, file: File) => {
    const data = new FormData();
    data.append('cover', file);
    return api.post<Item>(`/items/${id}/cover-upload`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);
  },
  delete: (id: number) => api.delete(`/items/${id}`),
  random: (filters: Omit<ItemFilters, 'search' | 'sort'> = {}) => {
    const params: any = { ...filters };
    return api.get<Item>('/items/random', { params }).then(r => r.data);
  },
};

export const lookupApi = {
  // Discogs — source principale pour la musique (pochettes + infos de pressage)
  searchDiscogs: (q: string) => api.get('/lookup/discogs', { params: { q } }).then(r => r.data),
  getDiscogsDetail: (id: number) => api.get(`/lookup/discogs/${id}`).then(r => r.data),
  getMusicEditorial: (params: {
    artist: string;
    album: string;
    discogs_id?: number | null;
    year?: number | null;
    sources?: MusicEditorialSourceKey[];
  }) =>
    api.get<MusicEditorial>('/lookup/music-editorial', { params }).then(r => r.data),
  // MusicBrainz — secours si Discogs ne renvoie rien / token absent
  searchMusic: (q: string) => api.get('/lookup/music', { params: { q } }).then(r => r.data),
  getMusicDetail: (mbid: string) => api.get(`/lookup/music/${mbid}`).then(r => r.data),
  searchVideo: (q: string) => api.get('/lookup/video', { params: { q } }).then(r => r.data),
  getVideoDetail: (tmdb_id: number, media_type = 'movie') =>
    api.get(`/lookup/video/${tmdb_id}`, { params: { media_type } }).then(r => r.data),
};

export default api;
