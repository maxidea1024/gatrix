import { apiService } from './api';
import { 
  Invitation, 
  CreateInvitationRequest, 
  InvitationResponse 
} from '../types/invitation';

class InvitationService {
  private readonly ADMIN_BASE_URL = '/admin/invitations';
  private readonly PUBLIC_BASE_URL = '/invitations';

  // Admin: create invitation
  async createInvitation(data: CreateInvitationRequest): Promise<InvitationResponse> {
    const response = await apiService.post(this.ADMIN_BASE_URL, data);
    return response.data;
  }

  // Admin: get current invitation for the admin (if any)
  async getCurrentInvitation(): Promise<Invitation | null> {
    try {
      const response = await apiService.get(`${this.ADMIN_BASE_URL}/current`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  // Admin: delete an invitation
  async deleteInvitation(id: string): Promise<void> {
    await apiService.delete(`${this.ADMIN_BASE_URL}/${id}`);
  }

  // Public: validate invitation token
  async validateInvitation(token: string): Promise<{ valid: boolean; invitation?: Invitation }> {
    const response = await apiService.get(`${this.PUBLIC_BASE_URL}/validate/${token}`);
    return response.data;
  }

  // Public: accept invitation with user registration data
  async acceptInvitation(token: string, userData: {
    username: string;
    password: string;
    email: string;
    fullName: string;
  }): Promise<void> {
    await apiService.post(`${this.PUBLIC_BASE_URL}/accept/${token}`, userData);
  }

  generateInviteUrl(token: string): string {
    const baseUrl = window.location.origin;
    return `${baseUrl}/signup?invite=${token}`;
  }
}

export const invitationService = new InvitationService();
