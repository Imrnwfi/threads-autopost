// Diganti oleh GitHub Actions dengan 7 aksara pertama commit SHA semasa deploy.
export const APP_VERSION = '__BUILD__';
export const isDev = APP_VERSION.startsWith('__');
