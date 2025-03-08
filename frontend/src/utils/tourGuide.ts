import { getSession } from 'next-auth/react';
import { updateUserApi, getUserApi } from './api';

export const getTourKey = async (): Promise<string> => {
  const session = await getSession();
  if (!session?.user?.email) return '';
  
  return `hasSeenTour-${session.user.email}`;
};

export const hasSeenTour = async (): Promise<boolean> => {
  const tourKey = await getTourKey();
  // Is there a local storage item for this user?
  const key = localStorage.getItem(tourKey);
  if (key) {
    return key === 'true';
  }
  // If not, check the backend
  const session = await getSession();
  if (session?.user?.id) {
    const user = await getUserApi(session.user.id);
    return user.hasSeenTour;
  }
  return false;
};

export const setHasSeenTour = async (hasSeenTour: boolean): Promise<void> => {
  const session = await getSession();
  const tourKey = await getTourKey();
  
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
