import { updateUserApi, getUserApi } from './api';
import { AppSession } from '@/types/AppSession';

export const getTourKey = async (session: AppSession | null): Promise<string> => {
  if (!session?.user?.email) return '';
  
  return `hasSeenTour-${session.user.email}`;
};

export const hasSeenTour = async (session: AppSession | null): Promise<boolean> => {
  const tourKey = await getTourKey(session);
  // Is there a local storage item for this user?
  const key = localStorage.getItem(tourKey);
  if (key) {
    return key === 'true';
  }
  // If not, check the backend
  if (session?.user?.id) {
    const user = await getUserApi(session.user.id);
    return user.hasSeenTour;
  }
  return false;
};

export const setHasSeenTour = async (hasSeenTour: boolean, session: AppSession | null): Promise<void> => {
  const tourKey = await getTourKey(session);
  
  // Save to localStorage
  localStorage.setItem(tourKey, hasSeenTour.toString());
  
  // Save to backend via API if user is logged in
  if (session?.user?.id) {
    try {
      await updateUserApi(session.user.id, { hasSeenTour: hasSeenTour });
    } catch (error) {
      console.error('Failed to update tour state in backend:', error);
      // Continue even if API call fails, as localStorage is set
    }
  }
};
