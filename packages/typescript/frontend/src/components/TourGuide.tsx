'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAppSession } from '@/contexts/AppSessionContext';
import { useRouter } from 'next/navigation';
import { useOrganization } from '@/contexts/OrganizationContext';
import { setHasSeenTour, hasSeenTour } from '@/utils/tourGuide';

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
  const { session } = useAppSession();
  const router = useRouter();
  const { currentOrganization } = useOrganization();

  // Define the tour steps with useMemo
  const tourSteps = useMemo<TourStep[]>(() => [
    {
      id: 'create-token',
      title: 'Create Organization Token',
      content: 'First, create an organization token to authenticate with the API and start receiving telemetry data.',
      selector: '[data-tour="create-token"]',
      position: 'right',
      page: '/settings/user/developer/organization-access-tokens'
    },
    {
      id: 'view-telemetry-logs',
      title: 'View Telemetry Logs',
      content: 'Monitor incoming telemetry logs to see real-time activity and system events.',
      selector: '[data-tour="telemetry-logs"]',
      position: 'bottom',
      page: `/orgs/${currentOrganization?.id}/telemetry?tab=logs`
    },
    {
      id: 'analytics-time-range',
      title: 'Change Time Range',
      content: 'Use the time range controls to analyze data over different periods - from 1 hour to custom ranges.',
      selector: '[data-tour="analytics-time-range"]',
      position: 'bottom',
      page: `/orgs/${currentOrganization?.id}/analytics`
    }
  ], [currentOrganization?.id]);

  // Check if this is the user's first login
  useEffect(() => {
    //console.log("TourGuide: Session state changed", { session, hasSession: !!session });
    
    let timeoutId: NodeJS.Timeout;
    
    const checkTourStatus = async () => {
      if (session) {
        // Use a more specific key that includes the user's email to ensure it's per-user
        const tour = await hasSeenTour(session);
        //console.log("TourGuide: Checking if user has seen tour", { hasSeenTour: tour });
        
        if (!tour) {
          //console.log("TourGuide: User hasn't seen tour, scheduling tour start");
          // Delay the start of the tour to ensure the UI is fully loaded
          timeoutId = setTimeout(() => {
            //console.log("TourGuide: Starting tour now");
            setShowTour(true);
          }, 1000);
        } else {
          //console.log("TourGuide: User has already seen tour");
        }
      }
    };
    
    checkTourStatus();
    
    // Cleanup function
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [session]);

  // Handle navigation between pages during the tour
  useEffect(() => {
    if (showTour && currentStep < tourSteps.length) {
      const step = tourSteps[currentStep];
      
      // If the step has a page property, navigate to that page
      if (step.page) {
        //console.log(`TourGuide: Navigating to ${step.page} for step ${currentStep}`);
        router.push(step.page);
      }
    }
  }, [showTour, currentStep, tourSteps, router]);

  // Add this function to manually start the tour
  const startTour = useCallback(() => {
    setCurrentStep(0); // Reset to first step
    setShowTour(true);
    if (session) {
      setHasSeenTour(false, session);
    }
  }, [session]);

  // Memoize the functions with useCallback
  const endTour = useCallback(() => {
    setShowTour(false);
  }, []);

  // Memoize the functions with useCallback
  const skipTour = useCallback(() => {
    setShowTour(false);
    if (session) {
      setHasSeenTour(true, session);
    }
  }, [session]);

  // Now the useEffect hooks can safely reference these functions
  useEffect(() => {
    if (showTour && currentStep < tourSteps.length) {
      // Reset tooltip ready state when step changes
      setTooltipReady(false);
      
      const step = tourSteps[currentStep];
      //console.log(`TourGuide: Looking for element with selector: ${step.selector}`);
      
      // Add a longer delay to allow the page to load after navigation
      const timer = setTimeout(() => {
        const element = document.querySelector(step.selector);
        
        if (element) {
          //console.log(`TourGuide: Found element for step ${currentStep}`, element);
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
          //console.warn(`TourGuide: Element not found for step ${currentStep} with selector ${step.selector}`);
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
              // Go to the next step if the element still doesn't exist
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
  }, [showTour, currentStep, tourSteps, endTour, skipTour]);

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

  // Then update the useEffect
  useEffect(() => {
    window.startTourGuide = startTour;
    return () => {
      delete window.startTourGuide;
    };
  }, [startTour]);

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
            <a 
              href="#"
              onClick={(e) => {
                e.preventDefault();
                skipTour();
              }}
              className="text-white text-sm underline mr-4 hover:text-blue-100"
            >
              Skip Tour
            </a>
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