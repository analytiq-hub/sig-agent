'use client'

import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { AppSession } from '@/types/AppSession'

interface AppSessionContextType {
  session: AppSession | null
  status: 'loading' | 'authenticated' | 'unauthenticated'
}

const AppSessionContext = createContext<AppSessionContextType>({
  session: null,
  status: 'loading'
})

export const useAppSession = () => useContext(AppSessionContext)

export const AppSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data: session, status } = useSession()
  const [cachedSession, setCachedSession] = useState<AppSession | null>(null)
  const [cachedStatus, setCachedStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading')
  const lastUpdateRef = useRef<number>(0)
  
  // Only update cached session if it actually changed or after 1 minute
  useEffect(() => {
    const now = Date.now()
    const hasChanged = JSON.stringify(session) !== JSON.stringify(cachedSession) || status !== cachedStatus
    const isStale = now - lastUpdateRef.current > 60000 // 1 minute
    
    if (hasChanged || isStale) {
      setCachedSession(session as AppSession | null)
      setCachedStatus(status)
      lastUpdateRef.current = now
    }
  }, [session, status, cachedSession, cachedStatus])
  
  return (
    <AppSessionContext.Provider value={{
      session: cachedSession,
      status: cachedStatus
    }}>
      {children}
    </AppSessionContext.Provider>
  )
}