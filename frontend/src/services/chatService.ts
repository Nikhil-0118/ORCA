import { QueryApiResponse } from '../types/chat.types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export interface SendQueryPayload {
  query: string;
  lat?: number;
  lon?: number;
  session_id?: string;
}

export const chatService = {
  async sendQuery(payload: SendQueryPayload): Promise<QueryApiResponse> {
    const body = {
      query: payload.query,
      location:
        payload.lat !== undefined && payload.lon !== undefined
          ? { lat: payload.lat, lon: payload.lon }
          : { lat: 13.0827, lon: 80.2707 },
      session_id: payload.session_id || `session-${Date.now()}`,
    };

    const response = await fetch(`${BASE_URL}/api/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.detail || `HTTP error! Status: ${response.status}`);
    }

    const data: QueryApiResponse = await response.json();
    return data;
  },
};
