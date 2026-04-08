import axios from 'axios';

const FIREBASE_FUNCTIONS_URL = 'https://us-central1-okb-ehr.cloudfunctions.net';

export interface VerifyIdentityRequest {
  fullName: string;
  dateOfBirth: string; // YYYY-MM-DD format
}

export interface VerifyIdentityResponse {
  verified: boolean;
  verificationId?: string;
  phoneLast4?: string;
  patientName?: string;
  fullPhoneNumber?: string;
  patientEmail?: string;
  error?: string;
}

export interface SendOTPRequest {
  verificationId: string;
}

export interface SendOTPResponse {
  success: boolean;
  message: string;
  developmentOTP?: string; // Only in development
  expiresIn: number; // seconds
  error?: string;
}

export interface VerifyOTPRequest {
  verificationId: string;
  otp: string;
}

export interface VerifyOTPResponse {
  success: boolean;
  authenticated: boolean;
  patientUuid?: string;
  token?: string;
  error?: string;
  attemptsRemaining?: number;
}

class OTPService {
  // Step 1: Verify patient identity with name + DOB
  async verifyPatientIdentity(request: VerifyIdentityRequest): Promise<VerifyIdentityResponse> {
    try {
      const response = await axios.post(
        `${FIREBASE_FUNCTIONS_URL}/verifyPatientIdentity`,
        request,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Identity verification error:', error);
      return {
        verified: false,
        error: error.response?.data?.error || 'Failed to verify identity',
      };
    }
  }

  // Step 2: Send OTP to patient's phone
  async sendOTP(request: SendOTPRequest): Promise<SendOTPResponse> {
    try {
      const response = await axios.post(
        `${FIREBASE_FUNCTIONS_URL}/sendOTP`,
        request,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Send OTP error:', error);
      return {
        success: false,
        message: 'Failed to send OTP',
        expiresIn: 0,
        error: error.response?.data?.error || 'Failed to send OTP',
      };
    }
  }

  // Step 3: Verify OTP code
  async verifyOTP(request: VerifyOTPRequest): Promise<VerifyOTPResponse> {
    try {
      const response = await axios.post(
        `${FIREBASE_FUNCTIONS_URL}/verifyOTP`,
        request,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Verify OTP error:', error);
      return {
        success: false,
        authenticated: false,
        error: error.response?.data?.error || 'Failed to verify OTP',
        attemptsRemaining: error.response?.data?.attemptsRemaining,
      };
    }
  }
}

export const otpService = new OTPService();
export default otpService;
