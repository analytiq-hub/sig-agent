'use client'

import React, { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useOrganization } from '@/contexts/OrganizationContext';

interface TourStep {
  id: string;
  title: string;
  content: string;
  selector: string;
  position: 'top' | 'right' | 'bottom' | 'left';
  page?: string;
}

// Add this interface at the top of your file
declare global {
  interface Window {
    startTourGuide?: () => void;
  }
}

const TourGuide = () => {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [showTour, setShowTour] = useState<boolean>(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [tooltipReady, setTooltipReady] = useState<boolean>(false);
  const { data: session } = useSession();
  const router = useRouter();
  const { currentOrganization } = useOrganization();

  // Define the tour steps with useMemo
  const tourSteps = useMemo<TourStep[]>(() => [
    {
      id: 'schemas',
      title: 'Create Schemas',
      content: 'Define document schemas to extract structured data from your documents.',
      selector: '[data-tour="schemas-tab"]',
      position: 'bottom',
      page: `/orgs/${currentOrganization?.id}/models?tab=schemas`
    },
    {
      id: 'prompts',
      title: 'Create Prompts',
      content: 'Create and manage prompts to guide AI in processing your documents.',
      selector: '[data-tour="prompts-tab"]',
      position: 'bottom',
      page: `/orgs/${currentOrganization?.id}/models?tab=prompts`
    },
    {
        id: 'upload',
        title: 'Upload Docs',
        content: 'Click here to upload your documents for processing.',
        selector: '[data-tour="upload-button"]',
        position: 'right',
        page: `/orgs/${currentOrganization?.id}/upload`
    },
    {
      id: 'documents',
      title: 'Documents',
      content: 'View and manage your uploaded documents.',
      selector: '[data-tour="documents-tab"]',
      position: 'bottom',
      page: `/orgs/${currentOrganization?.id}/list?tab=documents`
    },
    {
      id: 'tags',
      title: 'Configure Tags',
      content: 'Set up tags to organize and categorize documents and prompts.',
      selector: '[data-tour="tags-tab"]',
      position: 'bottom',
      page: `/orgs/${currentOrganization?.id}/list?tab=tags`
    }
  ], [currentOrganization?.id]);

  // Check if this is the user's first login
  useEffect(() => {
    console.log("TourGuide: Session state changed", { session, hasSession: !!session });
    
    if (session) {
      // Use a more specific key that includes the user's email to ensure it's per-user
      const tourKey = `hasSeenTour-${session.user?.email}`;
      const hasSeenTour = localStorage.getItem(tourKey);
      console.log("TourGuide: Checking localStorage", { tourKey, hasSeenTour });
      
      if (!hasSeenTour) {
        console.log("TourGuide: User hasn't seen tour, scheduling tour start");
        // Delay the start of the tour to ensure the UI is fully loaded
        const timer = setTimeout(() => {
          console.log("TourGuide: Starting tour now");
          setShowTour(true);
        }, 1000);
        return () => clearTimeout(timer);
      } else {
        console.log("TourGuide: User has already seen tour");
      }
    }
  }, [session]);

  // Handle navigation between pages during the tour
  useEffect(() => {
    if (showTour && currentStep < tourSteps.length) {
      const step = tourSteps[currentStep];
      
      // If the step has a page property, navigate to that page
      if (step.page) {
        console.log(`TourGuide: Navigating to ${step.page} for step ${currentStep}`);
        router.push(step.page);
      }
    }
  }, [showTour, currentStep, tourSteps, router]);

  // Position the tooltip based on the target element
  useEffect(() => {
    if (showTour && currentStep < tourSteps.length) {
      // Reset tooltip ready state when step changes
      setTooltipReady(false);
      
      const step = tourSteps[currentStep];
      console.log(`TourGuide: Looking for element with selector: ${step.selector}`);
      
      // Add a longer delay to allow the page to load after navigation
      const timer = setTimeout(() => {
        const element = document.querySelector(step.selector);
        
        if (element) {
          console.log(`TourGuide: Found element for step ${currentStep}`, element);
          const rect = element.getBoundingClientRect();
          let top = 0;
          let left = 0;
          
          switch (step.position) {
            case 'top':
              top = rect.top - 10;
              left = rect.left + rect.width / 2;
              break;
            case 'right':
              top = rect.top + rect.height / 2;
              left = rect.right + 10;
              break;
            case 'bottom':
              top = rect.bottom + 10;
              left = rect.left + rect.width / 2;
              break;
            case 'left':
              top = rect.top + rect.height / 2;
              left = rect.left - 10;
              break;
          }
          
          setTooltipPosition({ top, left });
          // Mark tooltip as ready to show after positioning
          setTooltipReady(true);
        } else {
          console.warn(`TourGuide: Element not found for step ${currentStep} with selector ${step.selector}`);
          // Try again with a longer delay if element not found
          const retryTimer = setTimeout(() => {
            const retryElement = document.querySelector(step.selector);
            if (retryElement) {
              // Element found on retry, position the tooltip
              const rect = retryElement.getBoundingClientRect();
              let top = 0;
              let left = 0;
              
              switch (step.position) {
                case 'top':
                  top = rect.top - 10;
                  left = rect.left + rect.width / 2;
                  break;
                case 'right':
                  top = rect.top + rect.height / 2;
                  left = rect.right + 10;
                  break;
                case 'bottom':
                  top = rect.bottom + 10;
                  left = rect.left + rect.width / 2;
                  break;
                case 'left':
                  top = rect.top + rect.height / 2;
                  left = rect.left - 10;
                  break;
              }
              
              setTooltipPosition({ top, left });
            } else {
              // Skip to the next step if the element still doesn't exist
              if (currentStep < tourSteps.length - 1) {
                setCurrentStep(currentStep + 1);
              } else {
                endTour();
              }
            }
          }, 1000); // Wait another second before giving up
          
          return () => clearTimeout(retryTimer);
        }
      }, 800); // Increase initial wait to 800ms
      
      return () => clearTimeout(timer);
    }
  }, [showTour, currentStep, tourSteps]);

  const nextStep = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      endTour();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const endTour = () => {
    setShowTour(false);
    if (session?.user?.email) {
      const tourKey = `hasSeenTour-${session.user.email}`;
      localStorage.setItem(tourKey, 'true');
    } else {
      localStorage.setItem('hasSeenTour', 'true'); // Fallback
    }
  };

  // Add this function to manually start the tour
  const startTour = () => {
    // Reset the tour flag using the same key pattern
    if (session?.user?.email) {
      localStorage.removeItem(`hasSeenTour-${session.user.email}`);
    } else {
      localStorage.removeItem('hasSeenTour');
    }
    
    // If the startTourGuide function is available, use it directly
    if (typeof window !== 'undefined' && window.startTourGuide) {
      window.startTourGuide();
    } else {
      // Otherwise reload the page to trigger the tour
      window.location.reload();
    }
    
    setShowTour(true);
  };

  // Then update the useEffect
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.startTourGuide = startTour;
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete window.startTourGuide;
      }
    };
  }, []);

  if (!showTour) return null;

  const step = tourSteps[currentStep];
  
  // Calculate tooltip class based on position
  const getTooltipClass = () => {
    switch (step.position) {
      case 'top':
        return 'transform -translate-x-1/2 -translate-y-full mb-2';
      case 'right':
        return 'transform translate-y-[-50%] ml-2';
      case 'bottom':
        return 'transform -translate-x-1/2 mt-2';
      case 'left':
        return 'transform translate-y-[-50%] -translate-x-full mr-2';
    }
  };

  // Calculate arrow styles based on position
  const getArrowStyles = () => {
    const baseStyles = {
      position: 'absolute',
      width: '0',
      height: '0',
      borderStyle: 'solid',
    } as const;

    switch (step.position) {
      case 'top':
        return {
          ...baseStyles,
          bottom: '-12px',
          left: '50%',
          transform: 'translateX(-50%)',
          borderWidth: '12px 12px 0 12px',
          borderColor: '#2563eb transparent transparent transparent',
        };
      case 'right':
        return {
          ...baseStyles,
          left: '-12px',
          top: '50%',
          transform: 'translateY(-50%)',
          borderWidth: '12px 12px 12px 0',
          borderColor: 'transparent #2563eb transparent transparent',
        };
      case 'bottom':
        return {
          ...baseStyles,
          top: '-12px',
          left: '50%',
          transform: 'translateX(-50%)',
          borderWidth: '0 12px 12px 12px',
          borderColor: 'transparent transparent #2563eb transparent',
        };
      case 'left':
        return {
          ...baseStyles,
          right: '-12px',
          top: '50%',
          transform: 'translateY(-50%)',
          borderWidth: '12px 0 12px 12px',
          borderColor: 'transparent transparent transparent #2563eb',
        };
    }
  };

  return (
    <div 
      className="fixed z-50 pointer-events-none"
      style={{ 
        top: 0, 
        left: 0, 
        width: '100%', 
        height: '100%' 
      }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black bg-opacity-50 pointer-events-auto" onClick={endTour} />
      
      {/* Tooltip */}
      <div 
        className={`absolute pointer-events-auto bg-blue-600 text-white p-4 rounded-lg shadow-lg max-w-xs ${getTooltipClass()} ${!tooltipReady ? 'opacity-0' : 'opacity-100 transition-opacity duration-300'}`}
        style={{ 
          top: tooltipPosition.top, 
          left: tooltipPosition.left 
        }}
      >
        {/* Arrow */}
        <div style={getArrowStyles()}></div>
        
        <h3 className="font-bold text-lg mb-2">{step.title}</h3>
        <p className="mb-4">{step.content}</p>
        
        <div className="flex justify-between">
          <div>
            {currentStep > 0 && (
              <button 
                onClick={prevStep}
                className="bg-white text-blue-600 px-3 py-1 rounded text-sm mr-2 hover:bg-blue-50"
              >
                Previous
              </button>
            )}
          </div>
          <div>
            <button 
              onClick={endTour}
              className="bg-white text-blue-600 px-3 py-1 rounded text-sm mr-2 hover:bg-blue-50"
            >
              Skip
            </button>
            <button 
              onClick={nextStep}
              className="bg-white text-blue-600 px-3 py-1 rounded text-sm hover:bg-blue-50"
            >
              {currentStep < tourSteps.length - 1 ? 'Next' : 'Finish'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TourGuide;