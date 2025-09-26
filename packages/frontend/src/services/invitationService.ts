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
      console.log('getCurrentInvitation response:', response);

      // apiService는 이미 response.data를 반환하므로
      // response는 백엔드에서 보낸 { success: true, data: {...} } 구조
      if (response?.success && response?.data) {
        return response.data;
      }

      return null;
    } catch (error: any) {
      console.error('getCurrentInvitation error:', error);
      if (error.status === 404) {
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
    if (!token) {
      return 'Invalid invitation token';
    }
    const baseUrl = window.location.origin;
    return `${baseUrl}/signup?invite=${token}`;
  }
}

export const invitationService = new InvitationService();
