import { getSession } from 'next-auth/react';



export const getTourKey = async (): Promise<string> => {
  const session = await getSession();
  if (!session?.user?.email) return '';
  
  return `hasSeenTour-${session.user.email}`;
};

export const hasSeenTour = async (): Promise<boolean> => {
  const tourKey = await getTourKey();
  return localStorage.getItem(tourKey) === 'true';
};

export const setTourKey = async (): Promise<void> => {
  const tourKey = await getTourKey();
  localStorage.setItem(tourKey, 'true');
};
