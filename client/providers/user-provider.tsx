"use client"

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react'
import { AuthState, UserData, createUserSession, deleteAccount as deleteUserAccount, getProfileByWallet } from '@/lib/services/auth'
import { getPetsByOwner } from '@/lib/services/pets'
import { Database } from '@/lib/types/database'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'

type Pet = Database['public']['Tables']['pets']['Row']

interface UserContextType extends AuthState {
  pets: Pet[]
  activePet: Pet | null
  login: (walletAddress: string, username?: string) => Promise<void>
  logout: () => void
  deleteAccount: () => Promise<void>
  refreshUserData: () => Promise<void>
  setActivePet: (pet: Pet) => void
  purchaseStudioUnlock: () => Promise<boolean>
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function useUser() {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return context
}

interface UserProviderProps {
  children: ReactNode
}

export function UserProvider({ children }: UserProviderProps) {
  const [user, setUser] = useState<UserData | null>(null)
  const [pets, setPets] = useState<Pet[]>([])
  const [activePet, setActivePetState] = useState<Pet | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isInitialVerificationComplete, setIsInitialVerificationComplete] = useState(false)

  const isAuthenticated = !!user

  // Load user data from session storage on mount
  useEffect(() => {
    const loadStoredUser = async () => {
      try {
        const storedUser = localStorage.getItem('datagotchi_user')
        const storedActivePet = localStorage.getItem('datagotchi_active_pet')
        
        if (storedUser) {
          const userData = JSON.parse(storedUser) as UserData
          setUser(userData)
          
          // Check if user data has points field, if not, refresh it
          if (userData.points === undefined || userData.studio_unlocked === undefined) {
            console.log('User data missing fields, refreshing...')
            const profile = await getProfileByWallet(userData.wallet_address)
            if (profile) {
              const updatedUserData: UserData = {
                wallet_address: profile.wallet_address,
                username: profile.username,
                points: profile.points,
                studio_unlocked: profile.studio_unlocked,
                created_at: profile.created_at
              }
              setUser(updatedUserData)
              localStorage.setItem('datagotchi_user', JSON.stringify(updatedUserData))
            }
          }
          
          // Load pets for this user and wait for completion
          await loadUserPets(userData.wallet_address)
        }
        
        if (storedActivePet) {
          const activePetData = JSON.parse(storedActivePet) as Pet
          setActivePetState(activePetData)
        }
      } catch (error) {
        console.error('Error loading stored user data:', error)
        // Clear corrupted data
        localStorage.removeItem('datagotchi_user')
        localStorage.removeItem('datagotchi_active_pet')
      } finally {
        setIsLoading(false)
        setIsInitialVerificationComplete(true)
      }
    }

    loadStoredUser()
  }, [])

  // Load user's pets
  const loadUserPets = async (walletAddress: string) => {
    try {
      const userPets = await getPetsByOwner(walletAddress)
      setPets(userPets)
      
      // Set first pet as active if no active pet is set
      if (userPets.length > 0 && !activePet) {
        setActivePetState(userPets[0])
        localStorage.setItem('datagotchi_active_pet', JSON.stringify(userPets[0]))
      }
      
      return userPets
    } catch (error) {
      console.error('Error loading user pets:', error)
      setPets([])
      return []
    }
  }

  // Login function
  const login = async (walletAddress: string, username?: string) => {
    setIsLoading(true)
    setIsInitialVerificationComplete(false)
    try {
      // Create or get user session from Supabase
      const userData = await createUserSession(walletAddress, username)
      
      setUser(userData)
      localStorage.setItem('datagotchi_user', JSON.stringify(userData))
      
      // Load user's pets and wait for completion
      await loadUserPets(userData.wallet_address)
      
      console.log('User logged in successfully:', userData)
    } catch (error) {
      console.error('Login error:', error)
      throw error
    } finally {
      setIsLoading(false)
      setIsInitialVerificationComplete(true)
    }
  }

  // Logout function
  const logout = () => {
    setUser(null)
    setPets([])
    setActivePetState(null)
    setIsInitialVerificationComplete(false)
    localStorage.removeItem('datagotchi_user')
    localStorage.removeItem('datagotchi_active_pet')
    console.log('User logged out')
  }

  // Refresh user profile data
  const refreshUserProfile = async () => {
    if (!user) return
    
    try {
      // Get fresh user data from database
      const profile = await getProfileByWallet(user.wallet_address)
      if (profile) {
        const updatedUserData: UserData = {
          wallet_address: profile.wallet_address,
          username: profile.username,
          points: profile.points,
          studio_unlocked: profile.studio_unlocked,
          created_at: profile.created_at
        }
        setUser(updatedUserData)
        localStorage.setItem('datagotchi_user', JSON.stringify(updatedUserData))
      }
    } catch (error) {
      console.error('Error refreshing user profile:', error)
    }
  }

  // Refresh user data
  const refreshUserData = async () => {
    if (!user) return
    
    try {
      // Refresh both user profile and pets
      await Promise.all([
        refreshUserProfile(),
        loadUserPets(user.wallet_address)
      ])
    } catch (error) {
      console.error('Error refreshing user data:', error)
    }
  }

  // Set active pet
  const setActivePet = (pet: Pet) => {
    setActivePetState(pet)
    localStorage.setItem('datagotchi_active_pet', JSON.stringify(pet))
  }

  // Delete account
  const deleteAccount = async () => {
    if (!user) return
    
    try {
      await deleteUserAccount(user.wallet_address)
      setUser(null)
      setPets([])
      setActivePetState(null)
      setIsInitialVerificationComplete(false)
      localStorage.removeItem('datagotchi_user')
      localStorage.removeItem('datagotchi_active_pet')
      console.log('Account deleted')
    } catch (error) {
      console.error('Error deleting account:', error)
    }
  }

  // Purchase studio unlock
  const purchaseStudioUnlock = async (): Promise<boolean> => {
    if (!user) {
      toast.error('Please log in to purchase studio unlock')
      return false
    }
    
    const STUDIO_UNLOCK_COST = 150
    
    try {
      // Check if user already has studio unlocked
      if (user.studio_unlocked) {
        toast.info('Studio is already unlocked!')
        return true
      }
      
      // Check if user has enough points
      if (user.points < STUDIO_UNLOCK_COST) {
        toast.error(`Insufficient points! You need ${STUDIO_UNLOCK_COST} points but only have ${user.points}`)
        return false
      }
      
      // Perform the transaction: deduct points and unlock studio
      const { data, error } = await supabase
        .from('profiles')
        .update({
          points: user.points - STUDIO_UNLOCK_COST,
          studio_unlocked: true
        })
        .eq('wallet_address', user.wallet_address)
        .select()
        .single()
      
      if (error) {
        console.error('Error purchasing studio unlock:', error)
        toast.error('Failed to purchase studio unlock. Please try again.')
        return false
      }
      
      // Update local user state
      const updatedUserData: UserData = {
        wallet_address: data.wallet_address,
        username: data.username,
        points: data.points,
        studio_unlocked: data.studio_unlocked,
        created_at: data.created_at
      }
      
      setUser(updatedUserData)
      localStorage.setItem('datagotchi_user', JSON.stringify(updatedUserData))
      
      toast.success(`Studio unlocked! ${STUDIO_UNLOCK_COST} points deducted.`)
      return true
      
    } catch (error) {
      console.error('Error purchasing studio unlock:', error)
      toast.error('Failed to purchase studio unlock. Please try again.')
      return false
    }
  }

  const value: UserContextType = {
    user,
    pets,
    activePet,
    isLoading,
    isAuthenticated,
    login,
    logout,
    deleteAccount,
    refreshUserData,
    setActivePet,
    purchaseStudioUnlock
  }

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  )
} 