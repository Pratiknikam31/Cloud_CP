import api from './client';
import { User } from '../types';

export const sendOtpApi = async (email: string) => {
  const res = await api.post('/auth/send-otp', { email });
  return res.data;
};

export const registerApi = async (data: any) => {
  const res = await api.post('/auth/register', data);
  return res.data;
};

export const loginApi = async (credentials: { email: string; password: string }) => {
  const res = await api.post('/auth/login', credentials);
  return res.data;
};

export const getMeApi = async () => {
  const res = await api.get('/auth/me');
  return res.data;
};

export const updateProfileApi = async (data: { name?: string; phone?: string; avatar?: string }) => {
  const res = await api.put('/auth/profile', data);
  return res.data;
};

export const changePasswordApi = async (data: { currentPassword: string; newPassword: string }) => {
  const res = await api.post('/auth/change-password', data);
  return res.data;
};
