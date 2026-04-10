// Configuration constants for the application
export const API_CONFIG = {
  /** Backend base URL (e.g. http://192.168.254.129:8200). */
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8200',
  BASE_PATH: '{{{apiBasePath}}}', // API base path (e.g., 'api/v1')
  TIMEOUT: 10000, // 10 seconds
}

export const getApiUrl = (endpoint: string): string => {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint
  const basePath = API_CONFIG.BASE_PATH ? `${API_CONFIG.BASE_PATH}/` : ''
  const fullPath = `${basePath}${cleanEndpoint}`.replace(/\/+/g, '/')
  return `${API_CONFIG.BASE_URL}/${fullPath}`
}

// Create a base query with better error handling
export const createBaseQuery = (baseUrl?: string) => {
  const basePath = API_CONFIG.BASE_PATH ? `/${API_CONFIG.BASE_PATH}` : ''
  const url = baseUrl || `${API_CONFIG.BASE_URL}${basePath}`.replace(/\/+/g, '/')
    
  return {
    baseUrl: url,
    timeout: API_CONFIG.TIMEOUT,
    prepareHeaders: (headers: Headers) => {
      headers.set('Accept', 'application/json')
      const serviceKey = process.env.NEXT_PUBLIC_GMS_SERVICE_KEY
      if (serviceKey) {
        headers.set('X-Service-Key', serviceKey)
      }
      return headers
    },
  }
}
