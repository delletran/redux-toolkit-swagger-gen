// Configuration constants for the application
export const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  TIMEOUT: 10000, // 10 seconds
  // Use proxy in development to avoid CORS issues
  USE_PROXY: process.env.NODE_ENV === 'development',
} as const

export const getApiUrl = (endpoint: string): string => {
  // Remove leading slash if present to avoid double slashes
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint
  
  // In development, use the proxy path to avoid CORS
  if (API_CONFIG.USE_PROXY && typeof window !== 'undefined') {
    return `/${cleanEndpoint}`
  }
  
  return `${API_CONFIG.BASE_URL}/${cleanEndpoint}`
}

// Create a base query with better error handling
export const createBaseQuery = (baseUrl?: string) => {
  // Use proxy in development, direct connection in production
  const url = baseUrl || (API_CONFIG.USE_PROXY && typeof window !== 'undefined' 
    ? baseUrl
    : API_CONFIG.BASE_URL)
  console.log(`Using API base URL: ${url}`)
    
  return {
    baseUrl: url,
    timeout: API_CONFIG.TIMEOUT,
    prepareHeaders: (headers: Headers) => {
      // Add common headers
      headers.set('Accept', 'application/json')
      return headers
    },
  }
}
