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
  watched_or_listened: boolean;
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
  created_at: string;
  updated_at: string;
}

export interface Track {
  position: number;
  title: string;
  length_sec: number | null;
}

export interface ItemFilters {
  type?: string;
  support?: string;
  genre?: string;
  decade?: number;
  state?: string;
  unwatched?: boolean;
  search?: string;
  sort?: 'title' | 'year' | 'added';
}

export const itemsApi = {
  list: (filters: ItemFilters = {}) => {
    const params: any = { ...filters };
    if (params.unwatched === false) delete params.unwatched;
    return api.get<Item[]>('/items', { params }).then(r => r.data);
  },
  get: (id: number) => api.get<Item>(`/items/${id}`).then(r => r.data),
  create: (data: Partial<Item>) => api.post<Item>('/items', data).then(r => r.data),
  update: (id: number, data: Partial<Item>) => api.put<Item>(`/items/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/items/${id}`),
  random: (filters: Omit<ItemFilters, 'search' | 'sort'> = {}) => {
    const params: any = { ...filters };
    if (params.unwatched === false) delete params.unwatched;
    return api.get<Item>('/items/random', { params }).then(r => r.data);
  },
};

export const lookupApi = {
  searchMusic: (q: string) => api.get('/lookup/music', { params: { q } }).then(r => r.data),
  getMusicDetail: (mbid: string) => api.get(`/lookup/music/${mbid}`).then(r => r.data),
  searchVideo: (q: string) => api.get('/lookup/video', { params: { q } }).then(r => r.data),
  getVideoDetail: (tmdb_id: number, media_type = 'movie') =>
    api.get(`/lookup/video/${tmdb_id}`, { params: { media_type } }).then(r => r.data),
};

export default api;
