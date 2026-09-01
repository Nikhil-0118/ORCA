import { ChatRequest, ChatResponse } from '../types/chat.types';
import { apiRequest, ApiResponse } from './apiClient';

export const chatService = {
  async sendQuery(payload: ChatRequest): Promise<ApiResponse<ChatResponse>> {
    return apiRequest<ChatResponse>('/api/v1/chat', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
