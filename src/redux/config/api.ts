// Configuration constants for the application
export const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  BASE_PATH: '{{{apiBasePath}}}', // API base path (e.g., 'api/v1')
  TIMEOUT: 10000, // 10 seconds
  // Use proxy in development to avoid CORS issues
  USE_PROXY: process.env.NODE_ENV === 'development',
} as const

export const getApiUrl = (endpoint: string): string => {
  // Remove leading slash if present to avoid double slashes
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint
  
  // Construct full path with base path
  const basePath = API_CONFIG.BASE_PATH ? `${API_CONFIG.BASE_PATH}/` : ''
  const fullPath = `${basePath}${cleanEndpoint}`.replace(/\/+/g, '/') // Remove double slashes
  
  // In development, use the proxy path to avoid CORS
  if (API_CONFIG.USE_PROXY && typeof window !== 'undefined') {
    return `/${fullPath}`
  }
  
  return `${API_CONFIG.BASE_URL}/${fullPath}`
}

// Create a base query with better error handling
export const createBaseQuery = (baseUrl?: string) => {
  // Construct base URL with base path
  const basePath = API_CONFIG.BASE_PATH ? `/${API_CONFIG.BASE_PATH}` : ''
  const baseUrlWithPath = `${API_CONFIG.BASE_URL}${basePath}`.replace(/\/+/g, '/')
  
  // Use proxy in development, direct connection in production
  const url = baseUrl || (API_CONFIG.USE_PROXY && typeof window !== 'undefined' 
    ? basePath || '/'
    : baseUrlWithPath)
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
