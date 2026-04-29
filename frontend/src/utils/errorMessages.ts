const ERROR_MESSAGES: Record<number, string> = {
  401: 'Your session has expired. Please sign in again.',
  403: 'You don\'t have permission to access this. Contact your administrator.',
  404: 'The requested resource was not found. It may have been deleted or moved.',
  429: 'Too many requests. Please wait a moment and try again.',
  500: 'Something went wrong on our end. Our team has been notified. Please try again later.',
  502: 'The service is temporarily unavailable. Please try again in a few moments.',
  503: 'The service is under maintenance. Please try again later.',
};

export function friendlyMessage(error: any, fallback: string): string {
  const status = error?.response?.status;
  if (status && ERROR_MESSAGES[status]) return ERROR_MESSAGES[status];
  if (error?.message?.includes('Network Error')) return 'Unable to connect to the server. Check your internet connection.';
  if (error?.message?.includes('timeout')) return 'The request took too long. Please try again.';
  return fallback;
}