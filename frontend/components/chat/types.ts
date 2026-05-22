export interface Message {
  id: string
  role: 'user' | 'ai'
  content: string
  timestamp: Date
  intent?: string
  confidence?: number
  source?: string
  isLoading?: boolean
  vehicleType?: string   // ← badge on DriveLegal messages
  action_url?:   string  // ← deep-link for Scan / Map / Authority / Dashboard
  action_label?: string  // ← button label for deep-link
  hierarchyData?: {
    resolution: {
      national: { fine: number; section: string } | null
      state: { fine: number; amendment: string } | null
      city: { fine: number; notes: string } | null
    }
    violation?: string
    recommended_level?: 'city' | 'state' | 'national'
  }
}

export interface ChatState {
  messages: Message[]
  isLoading: boolean
  location: { lat: number; lon: number } | null
  country: string
}
