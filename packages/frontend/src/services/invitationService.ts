import { apiService } from './api';
import { 
  Invitation, 
  CreateInvitationRequest, 
  InvitationResponse 
} from '../types/invitation';

class InvitationService {
  private readonly BASE_URL = '/invitations';

  async createInvitation(data: CreateInvitationRequest): Promise<InvitationResponse> {
    const response = await apiService.post(this.BASE_URL, data);
    return response.data;
  }

  async getCurrentInvitation(): Promise<Invitation | null> {
    try {
      const response = await apiService.get(`${this.BASE_URL}/current`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async deleteInvitation(id: string): Promise<void> {
    await apiService.delete(`${this.BASE_URL}/${id}`);
  }

  async validateInvitation(token: string): Promise<{ valid: boolean; invitation?: Invitation }> {
    const response = await apiService.get(`${this.BASE_URL}/validate/${token}`);
    return response.data;
  }

  async acceptInvitation(token: string, userData: {
    username: string;
    password: string;
    email: string;
    fullName: string;
  }): Promise<void> {
    await apiService.post(`${this.BASE_URL}/accept/${token}`, userData);
  }

  generateInviteUrl(token: string): string {
    const baseUrl = window.location.origin;
    return `${baseUrl}/signup?invite=${token}`;
  }
}

export const invitationService = new InvitationService();
