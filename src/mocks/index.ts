/**
 * Mock data layer — static data that stands in for the API during development.
 *
 * All mock objects satisfy the domain types in src/types/ exactly. This ensures
 * that screens and components develop against the real data shape, so replacing
 * this layer with real API calls requires no changes to screen files.
 *
 * CURRENT_USER_ID identifies which user is "me" in the mock dataset. It is used
 * throughout screens to distinguish the current user's plans, profile, and actions.
 *
 * When the backend is ready: replace each named export with a hook or service
 * that fetches from the real API. The import paths in screens stay the same.
 */
export { users, getUserById, AVATARS, CURRENT_USER_ID } from './users';
export { plans, getPlanById } from './plans';
export { notifications } from './notifications';
export { recaps, RECAP_IMAGES } from './recaps';
export { stories } from './stories';
